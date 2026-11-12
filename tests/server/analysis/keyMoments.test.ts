import { test } from "node:test";
import assert from "node:assert/strict";
import { selectKeyMoments } from "../../../src/server/analysis/keyMoments.ts";

// Scholar's mate: only plies 3 and 5 fill up to 3 (ply 2's swing 0.92 < 1).
test("Scholar's mate: picks plies 3, 5, 6 in game order", () => {
  const picked = selectKeyMoments([
    { ply: 1, swing: 0 },
    { ply: 2, swing: 0.92 },
    { ply: 3, swing: 1.3757619722840744 },
    { ply: 4, swing: 0 },
    { ply: 5, swing: 1.5629429523584264 },
    { ply: 6, swing: 46.62432762126237 },
    { ply: 7, swing: 0 },
  ]);
  assert.deepEqual(picked.map((p) => p.ply), [3, 5, 6]);
});

test("at most 5 moves with swing >= 10, even when more qualify", () => {
  const entries = [1, 2, 3, 4, 5, 6, 7].map((ply) => ({ ply, swing: 10 + ply }));
  const picked = selectKeyMoments(entries);
  assert.equal(picked.length, 5);
  // the five largest swings: plies 7,6,5,4,3 (swings 17,16,15,14,13), output in game order.
  assert.deepEqual(picked.map((p) => p.ply), [3, 4, 5, 6, 7]);
});

test("equal swings: earlier ply ranks first, so is preferred when topping up to 3", () => {
  const picked = selectKeyMoments([
    { ply: 5, swing: 2 },
    { ply: 1, swing: 2 },
    { ply: 3, swing: 2 },
    { ply: 7, swing: 2 },
  ]);
  assert.deepEqual(picked.map((p) => p.ply), [1, 3, 5]);
});

test("a swing below 1 is never a key moment, even in a quiet game", () => {
  const picked = selectKeyMoments([
    { ply: 1, swing: 0.5 },
    { ply: 2, swing: 0 },
    { ply: 3, swing: 0.9 },
  ]);
  assert.deepEqual(picked, []);
});

test("an empty or swingless game has no key moments", () => {
  assert.deepEqual(selectKeyMoments([]), []);
  assert.deepEqual(selectKeyMoments([{ ply: 1, swing: 0 }]), []);
});
