import { test } from "node:test";
import assert from "node:assert/strict";
import { moveAccuracy } from "../../../src/server/analysis/moveAccuracy.ts";

// docs/02-ANALYSIS-SPEC.md 18.2, grid of mover Win% before/after, bonus on.
test("move accuracy grid (section 18.2)", () => {
  const grid: Record<number, Record<number, number>> = {
    100: { 100: 100.0, 90: 64.58, 75: 32.57, 60: 15.91, 50: 9.53, 40: 5.4, 25: 1.77, 10: 0.0, 0: 0.0 },
    90: { 100: 100.0, 90: 100.0, 75: 51.52, 60: 25.77, 50: 15.91, 40: 9.53, 25: 3.92, 10: 1.0, 0: 0.0 },
    75: { 100: 100.0, 90: 100.0, 75: 100.0, 60: 51.52, 50: 32.57, 40: 20.31, 25: 9.53, 10: 3.92, 0: 1.77 },
    60: { 100: 100.0, 90: 100.0, 75: 100.0, 60: 100.0, 50: 64.58, 40: 41.02, 25: 20.31, 10: 9.53, 0: 5.4 },
    50: { 100: 100.0, 90: 100.0, 75: 100.0, 60: 100.0, 50: 100.0, 40: 64.58, 25: 32.57, 10: 15.91, 0: 9.53 },
    40: { 100: 100.0, 90: 100.0, 75: 100.0, 60: 100.0, 50: 100.0, 40: 100.0, 25: 51.52, 10: 25.77, 0: 15.91 },
    25: { 100: 100.0, 90: 100.0, 75: 100.0, 60: 100.0, 50: 100.0, 40: 100.0, 25: 100.0, 10: 51.52, 0: 32.57 },
    10: { 100: 100.0, 90: 100.0, 75: 100.0, 60: 100.0, 50: 100.0, 40: 100.0, 25: 100.0, 10: 100.0, 0: 64.58 },
  };
  for (const [before, row] of Object.entries(grid)) {
    for (const [after, expected] of Object.entries(row)) {
      const got = moveAccuracy(Number(before), Number(after));
      assert.ok(
        Math.abs(got - expected) < 0.01,
        `before ${before} after ${after}: got ${got}, expected ${expected}`,
      );
    }
  }
});

test("accuracy by loss, full precision (section 18.2)", () => {
  const cases: Array<[number, number]> = [
    [1, 96.60397651008962],
    [5, 80.81529992041436],
    [10, 64.57982845372067],
    [20, 41.016818741417126],
    [50, 9.527819142930593],
  ];
  for (const [loss, expected] of cases) {
    const got = moveAccuracy(100, 100 - loss);
    assert.ok(Math.abs(got - expected) < 1e-9, `loss ${loss}: got ${got}, expected ${expected}`);
  }
});

test("bonus keeps a tiny loss at 100, clamps a huge loss to 0", () => {
  assert.equal(moveAccuracy(100, 100 - 0.2236), 100);
  assert.equal(moveAccuracy(100, 0), 0);
});

test("a move that gains EP is always 100", () => {
  assert.equal(moveAccuracy(40, 60), 100);
});
