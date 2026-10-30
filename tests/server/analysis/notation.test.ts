import { test } from "node:test";
import assert from "node:assert/strict";
import { sanOf, pieceCapturedBy } from "../../../src/server/analysis/notation.ts";

test("sanOf converts a UCI move to SAN, with check/mate marks", () => {
  const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  assert.equal(sanOf(start, "e2e4"), "e4");
  // Scholar's mate final move: Qh5xf7#.
  const beforeMate = "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1";
  assert.equal(sanOf(beforeMate, "h5f7"), "Qxf7#");
  assert.equal(sanOf(start, "a1a5"), undefined); // illegal: nothing on a1 can reach a5 like that
});

test("pieceCapturedBy names the captured piece, or 'piece' when nothing is captured", () => {
  const withQueen = "4k3/8/8/8/8/8/8/3qK3 w - - 0 1";
  assert.equal(pieceCapturedBy(withQueen, "e1d1"), "queen");
  const empty = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
  assert.equal(pieceCapturedBy(empty, "e1e2"), "piece");
});
