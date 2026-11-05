import { test } from "node:test";
import assert from "node:assert/strict";
import { queueVisible, currentCount, queueLabel, progressPercent } from "../../../src/web/lib/queueStatus.ts";
import type { QueueStatus } from "../../../src/web/lib/live.svelte.ts";

function status(overrides: Partial<QueueStatus> = {}): QueueStatus {
  return { paused: false, pending: 0, done: 0, total: 0, running: null, ...overrides };
}

test("queueVisible: hidden when nothing is pending or running, even while paused", () => {
  assert.equal(queueVisible(undefined), false);
  assert.equal(queueVisible(status()), false);
  assert.equal(queueVisible(status({ paused: true })), false);
  assert.equal(queueVisible(status({ pending: 1 })), true);
  assert.equal(queueVisible(status({ running: { gameId: "g1", ply: 0, totalPlies: 10 } })), true);
});

// docs/07-UI-SPEC.md section 2.4: current = min(total, done + 1 if a game is running).
test("currentCount", () => {
  assert.equal(currentCount(status({ total: 5, done: 2 })), 2);
  assert.equal(currentCount(status({ total: 5, done: 2, running: { gameId: "g1", ply: 0, totalPlies: 10 } })), 3);
  assert.equal(currentCount(status({ total: 3, done: 3, running: { gameId: "g1", ply: 0, totalPlies: 10 } })), 3); // clamped
});

test("queueLabel: Analysing while running, Paused at while paused", () => {
  assert.equal(queueLabel(status({ total: 240, done: 11, running: { gameId: "g1", ply: 0, totalPlies: 10 } })), "Analysing 12 of 240…");
  assert.equal(queueLabel(status({ total: 240, done: 12, paused: true })), "Paused at 12 of 240");
});

test("progressPercent: 0 with nothing running, rounded percent otherwise", () => {
  assert.equal(progressPercent(status()), 0);
  assert.equal(progressPercent(status({ running: { gameId: "g1", ply: 0, totalPlies: 0 } })), 0);
  assert.equal(progressPercent(status({ running: { gameId: "g1", ply: 10, totalPlies: 40 } })), 25);
  assert.equal(progressPercent(status({ running: { gameId: "g1", ply: 1, totalPlies: 3 } })), 33);
});
