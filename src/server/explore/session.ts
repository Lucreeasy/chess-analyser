import type { UciEngine } from "../engine/engine.ts";
import type { EngineLineWithPv } from "../analysis/tacticTags.ts";
import { explorePositionError } from "./position.ts";
import { sanLineOf } from "../analysis/notation.ts";

/** docs/06-GAMES-SPEC.md section B10: one interactive engine slot, shared across all clients. */

export interface ExploreRequest {
  fen: string;
  sideToMove: "w" | "b";
  /** Stable for one Explore session (set when the client turns Explore on); distinguishes clients. */
  clientId: string;
  /** Fresh for every explored position; stale results are the client's own job to ignore. */
  requestId: string;
}

export interface ExploreLine extends EngineLineWithPv {
  /** `pv` as move text from the explored position, up to 6 plies (docs/06-GAMES-SPEC.md B10). */
  lineText: string;
}

export type ExploreEvent =
  | { type: "exploreProgress"; clientId: string; requestId: string; lines: ExploreLine[]; reachedDepth: number }
  | { type: "exploreDone"; clientId: string; requestId: string; lines: ExploreLine[]; reachedDepth: number }
  | { type: "exploreError"; clientId: string; requestId: string; message: string }
  /** The search this clientId had running was taken over by a different client's newer request. */
  | { type: "exploreBusy"; clientId: string };

export interface ExploreSessionDeps {
  getEngine: () => Promise<UciEngine>;
  onEvent: (event: ExploreEvent) => void;
  /** docs/06-GAMES-SPEC.md B10: 3 lines, depth target 40, hard cap 60s - overridable so tests run fast. */
  multipv?: number;
  depthTarget?: number;
  hardCapMs?: number;
}

export class ExploreSession {
  readonly #getEngine: () => Promise<UciEngine>;
  readonly #onEvent: (event: ExploreEvent) => void;
  readonly #multipv: number;
  readonly #depthTarget: number;
  readonly #hardCapMs: number;

  #current: { clientId: string; controller: AbortController } | undefined;

  constructor(deps: ExploreSessionDeps) {
    this.#getEngine = deps.getEngine;
    this.#onEvent = deps.onEvent;
    this.#multipv = deps.multipv ?? 3;
    this.#depthTarget = deps.depthTarget ?? 40;
    this.#hardCapMs = deps.hardCapMs ?? 60000;
  }

  /** Validates `req.fen` and, if searchable, (re)starts the search; otherwise returns the rejection reason. */
  start(req: ExploreRequest): { ok: true } | { ok: false; error: string } {
    const error = explorePositionError(req.fen);
    if (error) return { ok: false, error };

    // The newest request always wins; a *different* displaced client is told so (B10).
    const previous = this.#current;
    previous?.controller.abort();
    if (previous && previous.clientId !== req.clientId) {
      this.#onEvent({ type: "exploreBusy", clientId: previous.clientId });
    }

    const controller = new AbortController();
    this.#current = { clientId: req.clientId, controller };
    this.#run(req, controller);
    return { ok: true };
  }

  /** Stops whatever is currently searching, if anything (B10: "Back to game", leaving explore, etc.). */
  stop(): void {
    this.#current?.controller.abort();
    this.#current = undefined;
  }

  async #run(req: ExploreRequest, controller: AbortController): Promise<void> {
    const withLineText = (lines: EngineLineWithPv[]): ExploreLine[] =>
      lines.map((line) => ({ ...line, lineText: sanLineOf(req.fen, line.pv, 6) }));
    try {
      const engine = await this.#getEngine();
      const final = await engine.exploreSearch(
        req.fen,
        req.sideToMove,
        { multipv: this.#multipv, depthTarget: this.#depthTarget, hardCapMs: this.#hardCapMs, signal: controller.signal },
        (progress) =>
          this.#onEvent({
            type: "exploreProgress",
            clientId: req.clientId,
            requestId: req.requestId,
            lines: withLineText(progress.lines),
            reachedDepth: progress.reachedDepth,
          }),
      );
      this.#onEvent({
        type: "exploreDone",
        clientId: req.clientId,
        requestId: req.requestId,
        lines: withLineText(final.lines),
        reachedDepth: final.reachedDepth,
      });
    } catch (error) {
      this.#onEvent({
        type: "exploreError",
        clientId: req.clientId,
        requestId: req.requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (this.#current?.controller === controller) this.#current = undefined;
    }
  }
}
