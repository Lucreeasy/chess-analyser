import { test } from "node:test";
import assert from "node:assert/strict";
import { pieceNames } from "../../../src/web/lib/pieceNames.ts";

test("pieceNames: names every piece of the start position, rank 8 first", () => {
  const names = pieceNames("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  assert.equal(names.length, 32);
  assert.equal(names[0], "Black rook on a8");
  assert.ok(names.includes("White pawn on e2"));
  assert.equal(names.at(-1), "White rook on h1");
});

test("pieceNames: a sparse position", () => {
  assert.deepEqual(pieceNames("4k3/8/8/8/8/8/8/R3K3 w - - 0 1"), ["Black king on e8", "White rook on a1", "White king on e1"]);
});
