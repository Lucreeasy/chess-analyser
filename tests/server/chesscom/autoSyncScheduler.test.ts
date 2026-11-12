import { test } from "node:test";
import assert from "node:assert/strict";
import { AutoSyncScheduler, type TimerHandle } from "../../../src/server/chesscom/autoSyncScheduler.ts";
import type { SyncResult } from "../../../src/server/chesscom/sync.ts";

function okResult(added: number): SyncResult {
  return { months: [], added, duplicates: 0, failed: 0 };
}

interface FakeTimer extends TimerHandle {
  at: number;
  fn: () => unknown;
  cancelled: boolean;
}

/** A fake clock and timer queue: `advance()` runs every pending timer whose delay has elapsed, advancing the clock first. */
function fakeClock() {
  let time = 0;
  const pending: FakeTimer[] = [];
  return {
    now: () => time,
    setTimer: (fn: () => void, ms: number): TimerHandle => {
      const entry: FakeTimer = { at: time + ms, fn, cancelled: false, unref: () => {} };
      pending.push(entry);
      return entry;
    },
    clearTimer: (handle: TimerHandle) => {
      (handle as FakeTimer).cancelled = true;
    },
    advance: async (ms: number) => {
      time += ms;
      for (const entry of [...pending]) {
        if (!entry.cancelled && entry.at <= time) {
          pending.splice(pending.indexOf(entry), 1);
          entry.fn();
        }
      }
      for (let i = 0; i < 10; i++) await Promise.resolve(); // flush the resulting promise chain
    },
  };
}

test("status before any run: not running, no results, null lastRunAt", () => {
  const clock = fakeClock();
  const scheduler = new AutoSyncScheduler(() => 6, () => ["bc_tester"], async () => okResult(0), clock);
  assert.deepEqual(scheduler.status(), {
    enabled: true,
    intervalHours: 6,
    lastRunAt: null,
    nextRunAt: null,
    running: false,
    lastResults: [],
  });
});

test("enabled requires both a positive interval and a saved username", () => {
  const clock = fakeClock();
  assert.equal(new AutoSyncScheduler(() => 0, () => ["bc_tester"], async () => okResult(0), clock).status().enabled, false);
  assert.equal(new AutoSyncScheduler(() => 6, () => [], async () => okResult(0), clock).status().enabled, false);
});

test("start(): first run 60s later; after it finishes, the next is one interval after that", async () => {
  const clock = fakeClock();
  let calls = 0;
  const scheduler = new AutoSyncScheduler(
    () => 6,
    () => ["bc_tester"],
    async () => {
      calls++;
      return okResult(1);
    },
    clock,
  );
  scheduler.start();
  assert.equal(scheduler.status().nextRunAt, 60_000);

  await clock.advance(60_000);
  assert.equal(calls, 1);
  assert.equal(scheduler.status().lastRunAt, 60_000);
  assert.equal(scheduler.status().nextRunAt, 60_000 + 6 * 3_600_000);
});

test("an interval of 0 never schedules a run", () => {
  const clock = fakeClock();
  const scheduler = new AutoSyncScheduler(() => 0, () => ["bc_tester"], async () => okResult(0), clock);
  scheduler.start();
  assert.equal(scheduler.status().nextRunAt, null);
});

test("runs never overlap: a second trigger while running returns the current status, not a new run", async () => {
  const clock = fakeClock();
  let concurrentCalls = 0;
  let maxConcurrent = 0;
  const scheduler = new AutoSyncScheduler(
    () => 6,
    () => ["bc_tester"],
    async () => {
      concurrentCalls++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
      await Promise.resolve();
      concurrentCalls--;
      return okResult(1);
    },
    clock,
  );
  const first = scheduler.triggerNow();
  const second = scheduler.triggerNow();
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok && second.ok) assert.equal(second.status.running, true);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(maxConcurrent, 1);
});

test("triggerNow with no saved usernames is refused", () => {
  const clock = fakeClock();
  const scheduler = new AutoSyncScheduler(() => 6, () => [], async () => okResult(0), clock);
  const result = scheduler.triggerNow();
  assert.deepEqual(result, { ok: false, message: "set a chess.com username in Settings first" });
});

test("triggerNow works even with the interval off, and does not move nextRunAt", async () => {
  const clock = fakeClock();
  const scheduler = new AutoSyncScheduler(() => 0, () => ["bc_tester"], async () => okResult(1), clock);
  const result = scheduler.triggerNow();
  assert.equal(result.ok, true);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(scheduler.status().nextRunAt, null);
  assert.equal(scheduler.status().lastRunAt, 0);
});

test("a run with an empty username list does nothing but still updates lastRunAt", async () => {
  const clock = fakeClock();
  const scheduler = new AutoSyncScheduler(() => 6, () => [], async () => okResult(1), clock);
  scheduler.start();
  await clock.advance(60_000);
  assert.deepEqual(scheduler.status().lastResults, []);
  assert.equal(scheduler.status().lastRunAt, 60_000);
});

test("a username whose sync throws is recorded with zero counts and the error message", async () => {
  const clock = fakeClock();
  const scheduler = new AutoSyncScheduler(
    () => 6,
    () => ["bc_tester"],
    async () => {
      throw new Error("boom");
    },
    clock,
  );
  const result = scheduler.triggerNow();
  assert.equal(result.ok, true);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(scheduler.status().lastResults, [{ username: "bc_tester", added: 0, duplicates: 0, failed: 0, error: "boom" }]);
});

test("a failure for one username does not stop the next", async () => {
  const clock = fakeClock();
  const scheduler = new AutoSyncScheduler(
    () => 6,
    () => ["first", "second"],
    async (username: string) => {
      if (username === "first") throw new Error("boom");
      return okResult(2);
    },
    clock,
  );
  scheduler.triggerNow();
  await Promise.resolve();
  await Promise.resolve();
  const results = scheduler.status().lastResults;
  assert.equal(results.length, 2);
  assert.equal(results[0]!.error, "boom");
  assert.equal(results[1]!.added, 2);
});

test("a scheduled tick that finds a run already going waits for it, then schedules the next, without running itself", async () => {
  const clock = fakeClock();
  let calls = 0;
  let resolveRun: (() => void) | undefined;
  const scheduler = new AutoSyncScheduler(
    () => 6,
    () => ["bc_tester"],
    () => {
      calls++;
      return new Promise<SyncResult>((resolve) => {
        resolveRun = () => resolve(okResult(1));
      });
    },
    clock,
  );
  scheduler.start();
  scheduler.triggerNow(); // starts running immediately, ahead of the scheduled tick
  await Promise.resolve();
  assert.equal(calls, 1);

  await clock.advance(60_000); // the scheduled tick fires while the manual run is still going
  assert.equal(calls, 1); // it waited; it did not start a second run

  resolveRun?.();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls, 1);
  assert.equal(scheduler.status().nextRunAt, 60_000 + 6 * 3_600_000);
});
