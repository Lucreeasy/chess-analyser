import { test } from "node:test";
import assert from "node:assert/strict";
import { dotsFor, nearestPly, sliderValueText, accessibleSummary } from "../../../src/web/lib/evalGraph.ts";

test("dotsFor: only the dot classes, skipping undefined classification/winPercent", () => {
  const winPercents = [50, 60, 70, 20, undefined];
  const classes = [undefined, "brilliant", "good", "blunder", "miss"] as const;
  const dots = dotsFor(winPercents, classes.slice());
  assert.deepEqual(
    dots.map((d) => d.ply),
    [1, 3], // ply 2 is "good" (no dot), ply 4 has no winPercent
  );
  assert.deepEqual(
    dots.map((d) => d.shape),
    ["diamond", "round"], // brilliant is a diamond, blunder is round
  );
});

test("nearestPly: rounds and clamps to 0..plyCount", () => {
  assert.equal(nearestPly(0, 100, 40), 0);
  assert.equal(nearestPly(100, 100, 40), 40);
  assert.equal(nearestPly(50, 100, 40), 20);
  assert.equal(nearestPly(-10, 100, 40), 0);
  assert.equal(nearestPly(1000, 100, 40), 40);
});

test("sliderValueText: the spec's two exact formats", () => {
  assert.equal(sliderValueText(0, 40, 50), "Start position");
  assert.equal(sliderValueText(12, 40, 54.4), "Move 12, ply 12 of 40, White 54%");
  assert.equal(sliderValueText(12, 40, undefined), "Move 12, ply 12 of 40");
});

test("accessibleSummary: no values yet", () => {
  assert.equal(accessibleSummary([undefined, undefined], [undefined, undefined]), "No evaluation yet.");
});

test("accessibleSummary: start/end, lowest/highest, and error counts", () => {
  const winPercents = [50, 60, 20, 80];
  const classes = [undefined, "good", "blunder", "best"] as const;
  const text = accessibleSummary(winPercents, classes.slice());
  assert.equal(
    text,
    "White's winning chances over 3 plies: 50% at the start, 80% at move 3. Lowest 20% at move 2, highest 80% at move 3. 1 blunder, 0 mistakes, 0 misses.",
  );
});

test("accessibleSummary: omits the error sentence when there are none", () => {
  const winPercents = [50, 55];
  const classes = [undefined, "good"] as const;
  const text = accessibleSummary(winPercents, classes.slice());
  assert.equal(text, "White's winning chances over 1 plies: 50% at the start, 55% at move 1. Lowest 50% at the start, highest 55% at move 1.");
});
