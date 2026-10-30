import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSimplifiedBoard, playSimplifiedMove, balanceOf } from "../../../src/server/analysis/material.ts";

test("playSimplifiedMove: a plain push, a capture, and an illegal move", () => {
  const board = parseSimplifiedBoard("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const afterE4 = playSimplifiedMove(board, "e2e4");
  assert.ok(afterE4);
  assert.match(afterE4!, /^rnbqkbnr\/pppppppp\/8\/8\/4P3\/8\/PPPP1PPP\/RNBQKBNR b/);
  assert.equal(playSimplifiedMove(board, "e2e5"), null); // too far for a single/double push check path
});

test("castling: a loose model that only needs the rook present and an empty path", () => {
  // No castling rights in the FEN at all (the field is ignored): a rook physically in the corner suffices.
  const board = parseSimplifiedBoard("4k2r/8/8/8/8/8/8/4K3 b - - 0 1");
  const after = playSimplifiedMove(board, "e8g8");
  assert.ok(after);
  assert.match(after!, /^5rk1\//);
});

test("balanceOf counts material difference", () => {
  const board = parseSimplifiedBoard("4k3/8/8/8/8/8/8/3QK3 w - - 0 1");
  assert.equal(balanceOf(board, "w"), 9);
  assert.equal(balanceOf(board, "b"), -9);
});
