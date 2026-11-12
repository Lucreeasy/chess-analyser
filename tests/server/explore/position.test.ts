import { test } from "node:test";
import assert from "node:assert/strict";
import { legalDestinations, applyMove, isLegalPosition, explorePositionError } from "../../../src/server/explore/position.ts";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

test("isLegalPosition: a well-formed, legal position", () => {
  assert.equal(isLegalPosition(START), true);
});

test("isLegalPosition: malformed FEN text", () => {
  assert.equal(isLegalPosition("not a fen"), false);
  assert.equal(isLegalPosition("8/8/8/8/8/8/8/8 w - - 0 1"), false); // no kings
});

test("isLegalPosition: the side not to move is in check (chess.js's own validator misses this)", () => {
  // Black queen checks the White king along the open e-file; it's Black to move, so White is illegally in check.
  const fen = "4q3/8/8/8/8/8/8/4K2k b - - 0 1";
  assert.equal(isLegalPosition(fen), false);
});

test("legalDestinations: one entry per origin square with a legal move, empty for an illegal position", () => {
  const dests = legalDestinations(START);
  assert.deepEqual(dests.e2, ["e3", "e4"]);
  assert.deepEqual(dests.b1, ["a3", "c3"]);
  assert.equal(legalDestinations("not a fen").e2, undefined);
});

test("legalDestinations: empty for a finished position (stalemate)", () => {
  const stalemate = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1";
  assert.deepEqual(legalDestinations(stalemate), {});
});

test("applyMove: an ordinary move", () => {
  const result = applyMove(START, "e2e4");
  assert.equal(result.ok, true);
  assert.equal(result.san, "e4");
  assert.equal(result.uci, "e2e4");
  assert.equal(result.gameOver, undefined);
});

test("applyMove: checkmate reports the winner", () => {
  // Scholar's mate final move: Qh5xf7#.
  const beforeMate = "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1";
  const result = applyMove(beforeMate, "h5f7");
  assert.equal(result.ok, true);
  assert.equal(result.san, "Qxf7#");
  assert.equal(result.gameOver, "checkmate");
  assert.equal(result.winner, "w");
});

test("applyMove: stalemate", () => {
  // White to move, Kg6/Qf7 vs lone Black king on h8: ...Qf7 leaves Black stalemated.
  const beforeStalemate = "7k/8/6K1/5Q2/8/8/8/8 w - - 0 1";
  const result = applyMove(beforeStalemate, "f5f7");
  assert.equal(result.ok, true);
  assert.equal(result.gameOver, "stalemate");
  assert.equal(result.winner, undefined);
});

test("applyMove: an illegal move or an illegal starting position returns ok: false", () => {
  assert.equal(applyMove(START, "a1a5").ok, false); // nothing on a1 can reach a5 like that
  assert.equal(applyMove("not a fen", "e2e4").ok, false);
});

test("explorePositionError: undefined for a legal position, an invalid-FEN-style message otherwise", () => {
  assert.equal(explorePositionError(START), undefined);
  assert.match(explorePositionError("not a fen")!, /^invalid FEN:/);
  assert.match(explorePositionError("4q3/8/8/8/8/8/8/4K2k b - - 0 1")!, /^invalid FEN:.*in check/);
});
