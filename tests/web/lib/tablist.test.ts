import { test } from "node:test";
import assert from "node:assert/strict";
import { tabArrowKey } from "../../../src/web/lib/tablist.ts";

const IDS = ["a", "b", "c"] as const;

function keyEvent(key: string): KeyboardEvent {
  return { key, preventDefault: () => {} } as KeyboardEvent;
}

test("tabArrowKey: ArrowRight advances, wraps at the end", () => {
  assert.equal(tabArrowKey(keyEvent("ArrowRight"), IDS, "a"), "b");
  assert.equal(tabArrowKey(keyEvent("ArrowRight"), IDS, "c"), "a");
});

test("tabArrowKey: ArrowLeft goes back, wraps at the start", () => {
  assert.equal(tabArrowKey(keyEvent("ArrowLeft"), IDS, "b"), "a");
  assert.equal(tabArrowKey(keyEvent("ArrowLeft"), IDS, "a"), "c");
});

test("tabArrowKey: Home/End jump to the first/last", () => {
  assert.equal(tabArrowKey(keyEvent("Home"), IDS, "c"), "a");
  assert.equal(tabArrowKey(keyEvent("End"), IDS, "a"), "c");
});

test("tabArrowKey: any other key is ignored", () => {
  assert.equal(tabArrowKey(keyEvent("Enter"), IDS, "a"), undefined);
});

test("tabArrowKey: calls preventDefault only for a handled key", () => {
  let prevented = 0;
  const handled = { key: "ArrowRight", preventDefault: () => void prevented++ } as KeyboardEvent;
  tabArrowKey(handled, IDS, "a");
  assert.equal(prevented, 1);

  let notPrevented = 0;
  const ignored = { key: "Enter", preventDefault: () => void notPrevented++ } as KeyboardEvent;
  tabArrowKey(ignored, IDS, "a");
  assert.equal(notPrevented, 0);
});
