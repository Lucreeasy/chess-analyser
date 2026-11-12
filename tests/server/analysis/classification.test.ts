import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyMove, type ClassificationInput, type MoveClass } from "../../../src/server/analysis/classification.ts";

// "Unlisted inputs": not Book, no line 2, no previous opponent error,
// not a recapture or promotion, no sacrifice, not the engine move.
function input(overrides: Partial<ClassificationInput>): ClassificationInput {
  return {
    playedUci: "e2e4",
    engineUci: undefined,
    epBefore: 0.6,
    epAfter: 0.6,
    epLoss: 0,
    epOfLine2: undefined,
    isBook: false,
    previousOpponentClass: undefined,
    isRecapture: false,
    isPromotion: false,
    isSacrifice: false,
    ...overrides,
  };
}

const BEST = { playedUci: "e2e4", engineUci: "e2e4" };

// "Classification from inputs" - all 34 rows.
const cases: Array<[string, Partial<ClassificationInput>, MoveClass]> = [
  ["1: Book; EP 0.60 -> 0.10", { isBook: true, epBefore: 0.6, epAfter: 0.1, epLoss: 0.5 }, "book"],
  ["2: Book; EP 0.60 -> 0.60; sacrifice", { isBook: true, isSacrifice: true }, "book"],
  ["3: EP 0.60 -> 0.60; sacrifice", { isSacrifice: true }, "brilliant"],
  ["4: EP 0.62 -> 0.60 (loss 0.02); sacrifice", { epBefore: 0.62, epLoss: 0.02, isSacrifice: true }, "brilliant"],
  ["5: EP 0.51 -> 0.50; sacrifice", { epBefore: 0.51, epAfter: 0.5, epLoss: 0.01, isSacrifice: true }, "brilliant"],
  ["6: EP 0.50 -> 0.49; sacrifice", { epBefore: 0.5, epAfter: 0.49, epLoss: 0.01, isSacrifice: true }, "excellent"],
  ["7: EP 0.95 -> 0.95; sacrifice", { epBefore: 0.95, epAfter: 0.95, isSacrifice: true }, "excellent"],
  ["8: recapture blocks brilliant", { isSacrifice: true, isRecapture: true }, "excellent"],
  ["9: =best; line2 EP 0.30; sacrifice (brilliant beats great)", { ...BEST, epOfLine2: 0.3, isSacrifice: true }, "brilliant"],
  ["10: =best; line2 EP 0.45 (gap 0.15)", { ...BEST, epOfLine2: 0.45 }, "great"],
  ["11: =best; line2 EP 0.451 (gap 0.149)", { ...BEST, epOfLine2: 0.451 }, "best"],
  ["12: =best; EP 0.10; line2 EP 0.00", { ...BEST, epBefore: 0.1, epAfter: 0.1, epOfLine2: 0 }, "best"],
  ["13: =best; EP 0.95; line2 EP 0.50", { ...BEST, epBefore: 0.95, epAfter: 0.95, epOfLine2: 0.5 }, "best"],
  ["14: =best; EP 0.60; no line2", { ...BEST }, "best"],
  ["15: =best; EP 0.60 -> 0.30", { ...BEST, epAfter: 0.3, epLoss: 0.3 }, "best"],
  ["16: =best beats miss", { ...BEST, previousOpponentClass: "blunder", epBefore: 0.9, epAfter: 0.7, epLoss: 0.2 }, "best"],
  ["17: previous Blunder; loss 0.10", { previousOpponentClass: "blunder", epBefore: 0.75, epAfter: 0.65, epLoss: 0.1 }, "miss"],
  ["18: previous Blunder; loss 0.0999", { previousOpponentClass: "blunder", epBefore: 0.75, epAfter: 0.6501, epLoss: 0.0999 }, "inaccuracy"],
  ["19: previous Inaccuracy (not Mistake/Blunder)", { previousOpponentClass: "inaccuracy", epBefore: 0.75, epAfter: 0.65, epLoss: 0.1 }, "mistake"],
  ["20: previous Mistake; EP before = 0.70 inclusive", { previousOpponentClass: "mistake", epBefore: 0.7, epAfter: 0.55, epLoss: 0.15 }, "miss"],
  ["21: previous Mistake; EP before 0.69", { previousOpponentClass: "mistake", epBefore: 0.69, epAfter: 0.54, epLoss: 0.15 }, "mistake"],
  ["22: loss 0.40, EP after = 0.50 (not < 0.50)", { previousOpponentClass: "blunder", epBefore: 0.9, epAfter: 0.5, epLoss: 0.4 }, "miss"],
  ["23: carve-out: loss >= 0.20 and EP after < 0.50", { previousOpponentClass: "blunder", epBefore: 0.9, epAfter: 0.49, epLoss: 0.41 }, "blunder"],
  ["24: previous Blunder; loss 0.27, EP after 0.45", { previousOpponentClass: "blunder", epBefore: 0.72, epAfter: 0.45, epLoss: 0.27 }, "blunder"],
  ["25: not the engine move, no loss", {}, "excellent"],
  ["26: EP gain", { epBefore: 0.4, epAfter: 0.6, epLoss: 0 }, "excellent"],
  ["27: loss 0.0199", { epAfter: 0.5801, epLoss: 0.0199 }, "excellent"],
  ["28: loss 0.02", { epBefore: 0.62, epLoss: 0.02 }, "good"],
  ["29: loss 0.0499", { epAfter: 0.5501, epLoss: 0.0499 }, "good"],
  ["30: loss 0.05", { epAfter: 0.55, epLoss: 0.05 }, "inaccuracy"],
  ["31: loss 0.0999", { epAfter: 0.5001, epLoss: 0.0999 }, "inaccuracy"],
  ["32: loss 0.10", { epAfter: 0.5, epLoss: 0.1 }, "mistake"],
  ["33: loss 0.1999", { epAfter: 0.4001, epLoss: 0.1999 }, "mistake"],
  ["34: loss 0.20", { epAfter: 0.4, epLoss: 0.2 }, "blunder"],
];

for (const [name, overrides, expected] of cases) {
  test(`18.3 case ${name} -> ${expected}`, () => {
    assert.equal(classifyMove(input(overrides)), expected);
  });
}
