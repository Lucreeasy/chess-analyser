import { test } from "node:test";
import assert from "node:assert/strict";
import { rawPhase, phasesOf } from "../../../src/server/analysis/phases.ts";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// 10 non-pawn/king pieces: both queens and the a-side rooks removed from the start position.
const TEN_PIECES = "1nb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/1NB1KBNR w KQkq - 0 1";
// 14 pieces, but White's back rank has only 3 men (knights/bishops relocated, nothing captured).
const THIN_BACK_RANK = "rnbqkbnr/pppppppp/8/8/R7/2NBBN2/PPPPPPPP/3QK2R w KQkq - 0 1";
// A bare-bones ending: 2 pieces (rook + knight) left besides the kings.
const FEW_PIECES = "4k3/8/8/8/8/8/3N4/4KR2 w - - 0 1";

test("opening: 14 pieces, full back ranks, within the first 10 plies and in book", () => {
  assert.equal(rawPhase(START, 1, true), "opening");
});

test("middlegame once past ply 10 and out of book, even with the start position's material", () => {
  assert.equal(rawPhase(START, 11, false), "middlegame");
});

test("still opening past ply 10 while still in book", () => {
  assert.equal(rawPhase(START, 11, true), "opening");
});

test("middlegame once pieces drop to 10 or fewer, regardless of ply/book", () => {
  assert.equal(rawPhase(TEN_PIECES, 1, true), "middlegame");
});

test("middlegame once a back rank has fewer than 4 men, regardless of piece count", () => {
  assert.equal(rawPhase(THIN_BACK_RANK, 1, true), "middlegame");
});

test("endgame once pieces drop to 6 or fewer", () => {
  assert.equal(rawPhase(FEW_PIECES, 40, false), "endgame");
});

test("phasesOf never goes back: a later opening-like position stays at the phase already reached", () => {
  const phases = phasesOf([START, TEN_PIECES, START], [true, true, true]);
  assert.deepEqual(phases, ["opening", "middlegame", "middlegame"]);
});
