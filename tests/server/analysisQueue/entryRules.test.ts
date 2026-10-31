import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeQueueValues, shouldQueue } from "../../../src/server/analysisQueue/entryRules.ts";

test("mergeQueueValues: no existing entry just uses the request", () => {
  const merged = mergeQueueValues(undefined, { depth: "quick", force: false, urgent: false });
  assert.deepEqual(merged, { depth: "quick", force: false, urgent: false });
});

test("mergeQueueValues: depth is raised to the higher one, never lowered", () => {
  assert.equal(
    mergeQueueValues({ depth: "quick", force: false, urgent: false }, { depth: "deep", force: false, urgent: false }).depth,
    "deep",
  );
  assert.equal(
    mergeQueueValues({ depth: "deep", force: false, urgent: false }, { depth: "quick", force: false, urgent: false }).depth,
    "deep", // not lowered
  );
});

test("mergeQueueValues: force and urgent are OR'd", () => {
  const merged = mergeQueueValues({ depth: "standard", force: false, urgent: false }, { depth: "standard", force: true, urgent: false });
  assert.equal(merged.force, true);
  assert.equal(merged.urgent, false);

  const urgentBoost = mergeQueueValues({ depth: "standard", force: false, urgent: false }, { depth: "standard", force: false, urgent: true });
  assert.equal(urgentBoost.urgent, true);
});

test("shouldQueue: a running game is never re-queued, even with force", () => {
  assert.equal(shouldQueue("running", false), false);
  assert.equal(shouldQueue("running", true), false);
});

test("shouldQueue: a done game is skipped unless forced", () => {
  assert.equal(shouldQueue("done", false), false);
  assert.equal(shouldQueue("done", true), true);
});

test("shouldQueue: waiting, error and none are always queued", () => {
  for (const state of ["waiting", "error", "none"] as const) {
    assert.equal(shouldQueue(state, false), true);
    assert.equal(shouldQueue(state, true), true);
  }
});
