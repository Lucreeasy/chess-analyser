import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreTextFromLine, scoreTextFromWinPercent } from "../../../src/web/lib/scoreText.ts";

// The documented examples: +0.8, -1.2, 0.0, M3, -M3.
test("scoreTextFromLine: pawns with one decimal, sign shown except at 0.0", () => {
  assert.equal(scoreTextFromLine({ cp: 80 }), "+0.8");
  assert.equal(scoreTextFromLine({ cp: -120 }), "-1.2");
  assert.equal(scoreTextFromLine({ cp: 0 }), "0.0");
  assert.equal(scoreTextFromLine({ cp: -4 }), "0.0"); // rounds to zero, no stray minus sign
});

test("scoreTextFromLine: mate as M{n}, negative mate with a leading minus", () => {
  assert.equal(scoreTextFromLine({ mate: 3 }), "M3");
  assert.equal(scoreTextFromLine({ mate: -3 }), "-M3");
});

test("scoreTextFromLine: undefined line is unknown", () => {
  assert.equal(scoreTextFromLine(undefined), "–");
});

test("scoreTextFromLine: a line with neither cp nor mate is 0.0", () => {
  assert.equal(scoreTextFromLine({}), "0.0");
});

test("scoreTextFromWinPercent: 1-0/0-1 at the 99.99/0.01 edges, otherwise a derived pawn score", () => {
  assert.equal(scoreTextFromWinPercent(99.995), "1-0");
  assert.equal(scoreTextFromWinPercent(0.005), "0-1");
  assert.equal(scoreTextFromWinPercent(50), "0.0");
  assert.equal(scoreTextFromWinPercent(90), "+6.0");
});
