import { test } from "node:test";
import assert from "node:assert/strict";
import { terminalWhiteWinPercent } from "../../../src/server/analysis/terminal.ts";

// docs/02-ANALYSIS-SPEC.md section 2.5.
test("checkmate: 0 when White is mated, 100 when Black is mated", () => {
  // Scholar's mate final position, Black to move (White just mated Black).
  const blackMated = "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4";
  assert.equal(terminalWhiteWinPercent(blackMated), 100);
  // Fool's mate: White to move, mated.
  const whiteMated = "rnb1kbnr/pppp1ppp/8/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
  assert.equal(terminalWhiteWinPercent(whiteMated), 0);
});

test("stalemate: 50", () => {
  assert.equal(terminalWhiteWinPercent("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), 50);
});

test("insufficient material (K v K): 50", () => {
  assert.equal(terminalWhiteWinPercent("4k3/8/8/8/8/8/8/4K3 w - - 0 1"), 50);
});

test("the 50-move rule (half-move clock >= 100): 50", () => {
  assert.equal(terminalWhiteWinPercent("4k3/8/8/8/8/8/8/3QK3 w - - 100 80"), 50);
  assert.equal(terminalWhiteWinPercent("4k3/8/8/8/8/8/8/3QK3 w - - 99 80"), undefined);
});

test("threefold repetition is NOT terminal (cannot be seen from a FEN alone)", () => {
  // A normal, ongoing position: not terminal regardless of repeated history.
  assert.equal(terminalWhiteWinPercent("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"), undefined);
});

test("an ordinary position is not terminal", () => {
  assert.equal(terminalWhiteWinPercent("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"), undefined);
});
