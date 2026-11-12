import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSimplifiedBoard } from "../../../src/server/analysis/material.ts";
import { staticExchangeLoss, walkLine } from "../../../src/server/analysis/see.ts";

function see(fen: string, square: string): number {
  return staticExchangeLoss(parseSimplifiedBoard(fen), square);
}

// "Checked examples".
test("rook takes an undefended queen: 9", () => {
  // White rook on a1 can take the black queen on a8; nothing recaptures.
  assert.equal(see("q7/8/8/8/8/8/8/R6K b - - 0 1", "a8"), 9);
});

test("rook takes a pawn defended by a pawn: 0", () => {
  // Black pawn a3, defended by a black pawn on b4 (b4 attacks a3 diagonally forward for Black).
  assert.equal(see("8/8/8/8/1p6/p7/8/R3K3 b - - 0 1", "a3"), 0);
});

test("doubled rooks take a pawn defended by one rook: 1", () => {
  // White's a2 rook attacks the pawn directly; a1's rook is x-rayed behind it and joins in once a2 moves.
  // Black's a8 rook defends along the same file.
  assert.equal(see("r6k/8/8/8/8/p7/R7/R3K3 b - - 0 1", "a3"), 1);
});

test("bishop takes a pawn whose only defender (a knight) is pinned to its king: 1; without the pin: 0", () => {
  // White bishop g2 captures the pawn on e4. Black's only defender is the knight on f6, which is pinned to
  // the king on h8 by White's bishop on c3 along the c3-h8 diagonal (through f6): recapturing would expose
  // the king, so it is illegal.
  const pinned = see("7k/8/5n2/8/4p3/2B5/6B1/K7 w - - 0 1", "e4");
  assert.equal(pinned, 1);
  // Same position without the pinning bishop: the knight may legally recapture.
  const notPinned = see("7k/8/5n2/8/4p3/8/6B1/K7 w - - 0 1", "e4");
  assert.equal(notPinned, 0);
});

test("pawn takes a knight defended by a pawn: 2", () => {
  // Black pawn on e6 defends d5 (e6 attacks d5 diagonally forward for Black).
  assert.equal(see("4k3/8/4p3/3n4/4P3/8/8/4K3 w - - 0 1", "d5"), 2);
});

test("a king cannot take a defended pawn: 0; it takes an undefended one: 1", () => {
  assert.equal(see("4k3/8/8/8/3p4/4p3/4K3/8 b - - 0 1", "e3"), 0);
  assert.equal(see("4k3/8/8/8/8/4p3/4K3/8 b - - 0 1", "e3"), 1);
});

test("pawn b7 takes a rook on a8 (nothing recaptures): 5 + 8 = 13", () => {
  assert.equal(see("r7/1P6/8/8/8/8/8/4K2k b - - 0 1", "a8"), 13);
});

test("walkLine stops quietly at the first move that cannot be played", () => {
  const board = parseSimplifiedBoard("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
  // Moves alternate sides, as a real line does; the third move is unreadable.
  const result = walkLine(board, ["e1e2", "e8e7", "not-a-move", "e2e3"], 4, "w");
  assert.equal(result.afterEachPly.length, 2);
});
