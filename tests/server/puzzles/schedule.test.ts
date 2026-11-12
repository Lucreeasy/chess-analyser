import { test } from "node:test";
import assert from "node:assert/strict";
import { afterAttempt, newSchedule, type Schedule } from "../../../src/server/puzzles/schedule.ts";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1, 12);

test("a new puzzle is due at once", () => {
  assert.deepEqual(newSchedule(T0), { dueAt: T0, intervalDays: 0, attempts: 0 });
});

test("a first-try solve retires the puzzle for good, interval stays 0", () => {
  assert.deepEqual(afterAttempt(newSchedule(T0), true, T0), { dueAt: undefined, intervalDays: 0, attempts: 1, lastResult: "solved" });
});

test("the full life: miss, 1 day, solve, 3, solve, 7, miss back to 1, three solves retire it", () => {
  let s: Schedule = newSchedule(T0);
  let now = T0;
  /** Answers at `now`; returns the new interval and the days until the next due time; then waits until then. */
  const step = (solved: boolean) => {
    s = afterAttempt(s, solved, now);
    if (s.dueAt === undefined) return [s.intervalDays, "retired"];
    const days = (s.dueAt - now) / DAY;
    now = s.dueAt;
    return [s.intervalDays, days];
  };
  assert.deepEqual(step(false), [1, 1]);
  assert.deepEqual(step(true), [3, 3]);
  assert.deepEqual(step(true), [7, 7]);
  assert.deepEqual(step(false), [1, 1]);
  assert.deepEqual(step(true), [3, 3]);
  assert.deepEqual(step(true), [7, 7]);
  assert.deepEqual(step(true), [7, "retired"]);
  assert.equal(s.attempts, 7);
  assert.equal(s.lastResult, "solved");
});

test("a miss always means interval 1, due a day after the miss, even when retired or practised early", () => {
  const retired: Schedule = { dueAt: undefined, intervalDays: 7, attempts: 5, lastResult: "solved" };
  assert.deepEqual(afterAttempt(retired, false, T0), { dueAt: T0 + DAY, intervalDays: 1, attempts: 6, lastResult: "missed" });
  const waiting: Schedule = { dueAt: T0 + 2 * DAY, intervalDays: 3, attempts: 2, lastResult: "solved" };
  assert.deepEqual(afterAttempt(waiting, false, T0), { dueAt: T0 + DAY, intervalDays: 1, attempts: 3, lastResult: "missed" });
});

test("practising early, or a retired puzzle, solved: only attempts and the last result change", () => {
  const waiting: Schedule = { dueAt: T0 + DAY, intervalDays: 1, attempts: 1, lastResult: "missed" };
  assert.deepEqual(afterAttempt(waiting, true, T0), { ...waiting, attempts: 2, lastResult: "solved" });
  const retired: Schedule = { dueAt: undefined, intervalDays: 7, attempts: 4, lastResult: "solved" };
  assert.deepEqual(afterAttempt(retired, true, T0), { ...retired, attempts: 5 });
});

test("due at exactly now counts as a return (inclusive)", () => {
  const due: Schedule = { dueAt: T0, intervalDays: 1, attempts: 1, lastResult: "missed" };
  assert.deepEqual(afterAttempt(due, true, T0), { dueAt: T0 + 3 * DAY, intervalDays: 3, attempts: 2, lastResult: "solved" });
});
