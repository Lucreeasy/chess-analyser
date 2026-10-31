import type { SyncResult } from "./sync.ts";
import { summarizeUsernameSync, type UsernameSyncResult } from "./autoSyncResult.ts";

/** Auto-sync's schedule, status and "Sync now". docs/03-IMPORT-SPEC.md sections 4.3, 4.4. */

export interface AutoSyncStatus {
  enabled: boolean;
  intervalHours: number;
  lastRunAt: number | null;
  nextRunAt: number | null;
  running: boolean;
  lastResults: UsernameSyncResult[];
}

export type TriggerResult = { ok: true; status: AutoSyncStatus } | { ok: false; message: string };

export interface TimerHandle {
  unref?: () => void;
}

export interface SchedulerDeps {
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
}

const FIRST_RUN_DELAY_MS = 60_000;

/**
 * Runs each saved username's sync one after another (section 4.3), never
 * overlapping: a tick that finds a run already in progress waits for it
 * and then schedules the next, without running itself. "Sync now" starts
 * a run immediately and never moves `nextRunAt`.
 */
export class AutoSyncScheduler {
  readonly #intervalHours: number;
  readonly #getUsernames: () => string[];
  readonly #runUsername: (username: string) => Promise<SyncResult>;
  readonly #now: () => number;
  readonly #setTimer: (fn: () => void, ms: number) => TimerHandle;
  readonly #clearTimer: (handle: TimerHandle) => void;

  #runningPromise: Promise<void> | null = null;
  #lastRunAt: number | null = null;
  #nextRunAt: number | null = null;
  #lastResults: UsernameSyncResult[] = [];
  #timer: TimerHandle | null = null;

  constructor(intervalHours: number, getUsernames: () => string[], runUsername: (username: string) => Promise<SyncResult>, deps: SchedulerDeps = {}) {
    this.#intervalHours = intervalHours;
    this.#getUsernames = getUsernames;
    this.#runUsername = runUsername;
    this.#now = deps.now ?? Date.now;
    this.#setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.#clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle as NodeJS.Timeout));
  }

  /** Schedules the first run, unless the interval is 0. */
  start(): void {
    if (this.#intervalHours > 0) this.#scheduleNext(FIRST_RUN_DELAY_MS);
  }

  /** Stops any pending timer; does not interrupt a run already in progress. */
  stop(): void {
    if (this.#timer) this.#clearTimer(this.#timer);
    this.#timer = null;
    this.#nextRunAt = null;
  }

  status(): AutoSyncStatus {
    return {
      enabled: this.#intervalHours > 0 && this.#getUsernames().length > 0,
      intervalHours: this.#intervalHours,
      lastRunAt: this.#lastRunAt,
      nextRunAt: this.#nextRunAt,
      running: this.#runningPromise !== null,
      lastResults: this.#lastResults,
    };
  }

  /** "Sync now": starts a run immediately, ignoring (not moving) the schedule. */
  triggerNow(): TriggerResult {
    if (this.#runningPromise) return { ok: true, status: this.status() };
    if (this.#getUsernames().length === 0) return { ok: false, message: "set a chess.com username in Settings first" };
    this.#runOnce();
    return { ok: true, status: this.status() };
  }

  #scheduleNext(delayMs: number): void {
    this.#nextRunAt = this.#now() + delayMs;
    this.#timer = this.#setTimer(() => this.#tick(), delayMs);
    this.#timer.unref?.();
  }

  async #tick(): Promise<void> {
    this.#nextRunAt = null;
    if (this.#runningPromise) {
      await this.#runningPromise; // a run (e.g. "Sync now") is already going: just wait for it
    } else {
      await this.#runOnce();
    }
    if (this.#intervalHours > 0) this.#scheduleNext(this.#intervalHours * 3_600_000);
  }

  #runOnce(): Promise<void> {
    const promise = this.#runBody();
    this.#runningPromise = promise;
    return promise.finally(() => {
      this.#runningPromise = null;
    });
  }

  async #runBody(): Promise<void> {
    const results: UsernameSyncResult[] = [];
    for (const username of this.#getUsernames()) {
      try {
        results.push(summarizeUsernameSync(username, await this.#runUsername(username)));
      } catch (error) {
        results.push({ username, added: 0, duplicates: 0, failed: 0, error: error instanceof Error ? error.message : String(error) });
      }
    }
    this.#lastResults = results;
    this.#lastRunAt = this.#now();
  }
}
