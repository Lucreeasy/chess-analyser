import type Database from "better-sqlite3";
import { listQueueOrdered, setQueueEntryRunning, finishAnalysis, recordAnalysisError, getQueueState, setPaused, getGame } from "../db.ts";
import { runAnalysis, AnalysisAbortedError } from "../runAnalysis.ts";
import { SEARCH_DEPTH } from "./depthPresets.ts";
import type { UciEngine } from "../engine/engine.ts";
import type { DepthPreset } from "../settings.ts";

/** The single background worker driving the analysis queue. */

export interface QueueStatus {
  paused: boolean;
  pending: number;
  done: number;
  total: number;
  running: { gameId: string; ply: number; totalPlies: number } | null;
}

export type WorkerEvent =
  | { type: "queue"; status: QueueStatus }
  | { type: "progress"; gameId: string; ply: number; total: number }
  | { type: "plyEval"; gameId: string; ply: number; win: number }
  | { type: "gameAnalysed"; gameId: string };

export interface WorkerDeps {
  now?: () => number;
  onEvent?: (event: WorkerEvent) => void;
}

/**
 * One game at a time, in `listQueueOrdered`'s order. Pause
 * aborts the running game back to waiting; any other failure is
 * recorded as an error and the queue continues. A finished game is
 * stored atomically by `finishAnalysis`.
 */
export class AnalysisWorker {
  readonly #db: Database.Database;
  readonly #getEngine: () => Promise<UciEngine>;
  readonly #now: () => number;
  readonly #onEvent: (event: WorkerEvent) => void;

  #pumping: Promise<void> | null = null;
  #stopped = false;
  #abortController: AbortController | null = null;
  #runningGameId: string | null = null;
  #runningPly = 0;
  #runningTotalPlies = 0;

  constructor(db: Database.Database, getEngine: () => Promise<UciEngine>, deps: WorkerDeps = {}) {
    this.#db = db;
    this.#getEngine = getEngine;
    this.#now = deps.now ?? Date.now;
    this.#onEvent = deps.onEvent ?? (() => {});
  }

  status(): QueueStatus {
    const state = getQueueState(this.#db);
    const pending = listQueueOrdered(this.#db).filter((entry) => !entry.running).length;
    return {
      paused: state.paused,
      pending,
      done: state.done,
      total: pending + (this.#runningGameId ? 1 : 0) + state.done,
      running: this.#runningGameId ? { gameId: this.#runningGameId, ply: this.#runningPly, totalPlies: this.#runningTotalPlies } : null,
    };
  }

  /** Call after queueing or resuming: starts the pump loop if it isn't already going. */
  notify(): void {
    if (this.#pumping || this.#stopped) return;
    this.#pumping = this.#pump().finally(() => {
      this.#pumping = null;
    });
  }

  /** Aborts the running game back to waiting; accepted requests still get queued while paused. */
  pause(): void {
    setPaused(this.#db, true);
    this.#abortController?.abort();
    this.#onEvent({ type: "queue", status: this.status() });
  }

  resume(): void {
    setPaused(this.#db, false);
    this.notify();
  }

  /**
   * Aborts `gameId` if it is the one currently running; a no-op
   * otherwise. For deleting a running game: the abort
   * takes the same AnalysisAbortedError path as pause (no error
   * recorded), and the caller deletes the game's rows itself.
   */
  abortGame(gameId: string): void {
    if (this.#runningGameId === gameId) this.#abortController?.abort();
  }

  /** Graceful shutdown: aborts the running game (back to waiting) and waits for the loop to settle. */
  async stop(): Promise<void> {
    this.#stopped = true;
    this.#abortController?.abort();
    await this.#pumping;
  }

  async #pump(): Promise<void> {
    while (!this.#stopped) {
      if (getQueueState(this.#db).paused) return;
      const next = listQueueOrdered(this.#db).find((entry) => !entry.running);
      if (!next) return;
      await this.#runOne(next.gameId, next.depth);
    }
  }

  async #runOne(gameId: string, depth: DepthPreset): Promise<void> {
    setQueueEntryRunning(this.#db, gameId, true);
    this.#runningGameId = gameId;
    this.#runningPly = 0;
    this.#runningTotalPlies = 0;
    this.#abortController = new AbortController();
    this.#onEvent({ type: "queue", status: this.status() });

    try {
      const game = getGame(this.#db, gameId);
      if (!game) throw new Error(`cannot analyse ${gameId}: game not found`);
      const engine = await this.#getEngine();
      const analysis = await runAnalysis(this.#db, engine, game.pgn, {
        depth: SEARCH_DEPTH[depth],
        engineName: "Stockfish",
        myColour: game.myColour,
        signal: this.#abortController.signal,
        onPosition: (ply, totalPlies, win) => {
          this.#runningPly = ply;
          this.#runningTotalPlies = totalPlies;
          this.#onEvent({ type: "progress", gameId, ply, total: totalPlies });
          this.#onEvent({ type: "plyEval", gameId, ply, win });
        },
      });
      finishAnalysis(this.#db, gameId, depth, analysis, this.#now());
      this.#onEvent({ type: "gameAnalysed", gameId });
    } catch (error) {
      if (error instanceof AnalysisAbortedError) {
        setQueueEntryRunning(this.#db, gameId, false);
      } else {
        recordAnalysisError(this.#db, gameId, error instanceof Error ? error.message : String(error), this.#now());
      }
    } finally {
      this.#runningGameId = null;
      this.#abortController = null;
      this.#onEvent({ type: "queue", status: this.status() });
    }
  }
}
