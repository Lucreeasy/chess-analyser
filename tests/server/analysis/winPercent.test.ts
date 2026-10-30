import { test } from "node:test";
import assert from "node:assert/strict";
import { winPercentFromCp, winPercentOfLine, isForcedMateFor } from "../../../src/server/analysis/winPercent.ts";

// docs/02-ANALYSIS-SPEC.md 18.1, White POV.
test("Win% reference table (section 18.1)", () => {
  const cases: Array<[number, number]> = [
    [-1000, 2.455256],
    [-500, 13.692834],
    [-300, 24.88745],
    [-200, 32.378836],
    [-100, 40.89741],
    [-50, 45.410356],
    [0, 50.0],
    [50, 54.589644],
    [100, 59.10259],
    [200, 67.621164],
    [300, 75.11255],
    [500, 86.307166],
    [1000, 97.544744],
    [2000, 97.544744], // clamped
  ];
  for (const [cp, expected] of cases) {
    assert.ok(
      Math.abs(winPercentFromCp(cp) - expected) < 1e-5,
      `cp ${cp}: got ${winPercentFromCp(cp)}, expected ${expected}`,
    );
  }
  assert.ok(Math.abs(winPercentFromCp(600) - 90.11) < 0.01);
  assert.ok(Math.abs(winPercentFromCp(150) - 63.47) < 0.01);
});

test("Win%(cp) + Win%(-cp) = 100", () => {
  for (const cp of [-900, -123, 0, 77, 999]) {
    assert.ok(Math.abs(winPercentFromCp(cp) + winPercentFromCp(-cp) - 100) < 1e-9);
  }
});

test("mate scores: any White mate 97.544744, any Black mate (or mate 0) 2.455256", () => {
  assert.ok(Math.abs(winPercentOfLine({ mate: 1 }) - 97.544744) < 1e-5);
  assert.ok(Math.abs(winPercentOfLine({ mate: 20 }) - 97.544744) < 1e-5);
  assert.ok(Math.abs(winPercentOfLine({ mate: -1 }) - 2.455256) < 1e-5);
  assert.ok(Math.abs(winPercentOfLine({ mate: 0 }) - 2.455256) < 1e-5);
});

test("a line with neither cp nor mate counts as 0 cp (Win% 50)", () => {
  assert.equal(winPercentOfLine({}), 50);
});

test("isForcedMateFor", () => {
  assert.equal(isForcedMateFor({ mate: 3 }, "w"), true);
  assert.equal(isForcedMateFor({ mate: 3 }, "b"), false);
  assert.equal(isForcedMateFor({ mate: -3 }, "b"), true);
  assert.equal(isForcedMateFor({ mate: 0 }, "w"), false);
  assert.equal(isForcedMateFor({ cp: 500 }, "w"), false);
});
