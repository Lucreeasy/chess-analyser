/**
 * docs/06-GAMES-SPEC.md section B10: Explore mode's client-side state - the
 * explored position, its legal destinations, the live top-3 lines, and the
 * line of moves played while exploring. One instance per Explore session
 * (created when the toggle turns on, destroyed when it turns off).
 */
import { apiGet, apiPost, ApiError } from "./api.ts";
import { live, onExploreProgress, onExploreDone, onExploreError, onExploreBusy } from "./live.svelte.ts";
import { scoreTextFromLine } from "./scoreText.ts";
import { exploreStatusText, yourLineText, type ExploreStatus } from "./exploreStatus.ts";
import { winPercentOfLine } from "../../server/analysis/winPercent.ts";
import type { MoveResult } from "../../server/explore/position.ts";
import type { ExploreLine } from "../../server/explore/session.ts";

export class ExploreState {
  fen: string = $state("");
  sideToMove: "w" | "b" = $state("w");
  sans: string[] = $state([]);
  /** "e2e4" (Move.lan) per explored move, parallel to `sans`, for the board's last-move highlight. */
  ucis: string[] = $state([]);
  lines: ExploreLine[] = $state([]);
  reachedDepth = $state(0);
  searching = $state(false);
  dests: Record<string, string[]> = $state({});
  gameOver: { type: "checkmate" | "stalemate" | "draw"; winner?: "w" | "b" } | undefined = $state();
  requestError: string | undefined = $state();
  /** docs/06-GAMES-SPEC.md B10: "while a new position awaits its first result, the last known value stays". */
  lastWinPercent: number | undefined = $state();

  #fens: string[] = [];
  #done = $state(false);
  readonly #clientId = crypto.randomUUID();
  #requestId = "";
  readonly #unsubscribe: (() => void)[];

  constructor(startFen: string, startSideToMove: "w" | "b") {
    this.fen = startFen;
    this.sideToMove = startSideToMove;
    this.#fens = [startFen];
    this.#unsubscribe = [
      onExploreProgress((e) => this.#onResult(e, false)),
      onExploreDone((e) => this.#onResult(e, true)),
      onExploreError((e) => this.#onError(e)),
      onExploreBusy((clientId) => {
        if (clientId === this.#clientId) this.#onError({ clientId, requestId: this.#requestId, message: "engine busy" });
      }),
    ];
    this.#refreshDests();
    this.#search();
  }

  get status(): ExploreStatus {
    if (this.gameOver) return { kind: "finished", gameOver: this.gameOver.type, winner: this.gameOver.winner };
    if (!live.connected) return { kind: "disconnected" };
    if (this.requestError) return { kind: "error", message: this.requestError };
    if (this.lines.length === 0) return { kind: "waiting" };
    return { kind: "result", scoreText: scoreTextFromLine(this.lines[0]), depth: this.reachedDepth, done: this.#done };
  }

  get statusText(): string {
    return exploreStatusText(this.status);
  }

  get lineText(): string | undefined {
    return yourLineText(this.#fens[0]!, this.sans);
  }

  get canUndo(): boolean {
    return this.sans.length > 0;
  }

  /** The last explored move's squares, for the board's highlight; undefined before any move. */
  get lastMove(): string | undefined {
    return this.ucis[this.ucis.length - 1];
  }

  /** The best line's first move, as the board's green arrow; none for a finished position. */
  get bestMoveArrow(): { orig: string; dest: string; brush: "green" } | undefined {
    const uci = this.lines[0]?.pv[0];
    if (this.gameOver || !uci) return undefined;
    return { orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush: "green" };
  }

  async playMove(uci: string): Promise<void> {
    let result: MoveResult;
    try {
      result = await apiPost<MoveResult>("explore/move", { fen: this.fen, uci });
    } catch {
      return; // a network hiccup on a move attempt: leave the board as it was, the user can try again.
    }
    if (!result.ok || !result.fen || !result.san || !result.uci) return;

    this.#fens = [...this.#fens, result.fen];
    this.sans = [...this.sans, result.san];
    this.ucis = [...this.ucis, result.uci];
    this.fen = result.fen;
    this.sideToMove = this.sideToMove === "w" ? "b" : "w";

    if (result.gameOver) {
      this.gameOver = { type: result.gameOver, winner: result.winner };
      this.dests = {};
      this.lines = [];
      this.lastWinPercent = result.gameOver === "checkmate" ? (result.winner === "w" ? 100 : 0) : 50;
      apiPost("explore/stop").catch(() => {});
    } else {
      this.gameOver = undefined;
      this.#refreshDests();
      this.#search();
    }
  }

  /** docs/06-GAMES-SPEC.md B10: undo removes the last explored move; it does not leave explore mode. */
  undo(): void {
    if (this.sans.length === 0) return;
    this.sans = this.sans.slice(0, -1);
    this.ucis = this.ucis.slice(0, -1);
    this.#fens = this.#fens.slice(0, -1);
    this.fen = this.#fens[this.#fens.length - 1]!;
    this.sideToMove = this.sideToMove === "w" ? "b" : "w";
    this.gameOver = undefined;
    this.#refreshDests();
    this.#search();
  }

  destroy(): void {
    apiPost("explore/stop").catch(() => {});
    for (const off of this.#unsubscribe) off();
  }

  async #refreshDests(): Promise<void> {
    try {
      this.dests = await apiGet<Record<string, string[]>>(`explore/dests?fen=${encodeURIComponent(this.fen)}`);
    } catch {
      this.dests = {};
    }
  }

  async #search(): Promise<void> {
    this.lines = [];
    this.reachedDepth = 0;
    this.#done = false;
    this.searching = true;
    this.requestError = undefined;
    const requestId = crypto.randomUUID();
    this.#requestId = requestId;
    try {
      const result = await apiPost<{ ok: boolean; error?: string }>("explore/search", {
        fen: this.fen,
        sideToMove: this.sideToMove,
        clientId: this.#clientId,
        requestId,
      });
      if (!result.ok) {
        this.requestError = result.error;
        this.searching = false;
      }
    } catch (e) {
      this.requestError = e instanceof ApiError ? e.message : "unexpected error";
      this.searching = false;
    }
  }

  #onResult(e: { clientId: string; requestId: string; lines: ExploreLine[]; reachedDepth: number }, done: boolean): void {
    if (e.clientId !== this.#clientId || e.requestId !== this.#requestId) return;
    this.lines = e.lines;
    this.reachedDepth = e.reachedDepth;
    this.#done = done;
    this.searching = !done;
    if (e.lines[0]) this.lastWinPercent = winPercentOfLine(e.lines[0]);
  }

  #onError(e: { clientId: string; requestId: string; message: string }): void {
    if (e.clientId !== this.#clientId || e.requestId !== this.#requestId) return;
    this.requestError = e.message;
    this.searching = false;
  }
}
