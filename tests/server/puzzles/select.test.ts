import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { puzzlesOfGame, puzzleId } from "../../../src/server/puzzles/select.ts";
import type { MoveRecord } from "../../../src/server/analysis/game.ts";
import { cpFromWinPercent } from "../../../src/server/analysis/winPercent.ts";

const WHITE_TO_MOVE = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const BLACK_TO_MOVE = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

/** cp (White POV) that gives White this EP. */
const cpFor = (ep: number) => cpFromWinPercent(ep * 100);

function move(fields: Partial<MoveRecord> = {}): MoveRecord {
  return {
    ply: 1,
    colour: "w",
    san: "a3",
    uci: "a2a3",
    fenBefore: WHITE_TO_MOVE,
    bestLine: { cp: cpFor(0.6), pv: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6", "b5a4"] },
    winPercentBefore: 60,
    winPercentAfter: 30,
    epLoss: 0.3,
    accuracy: 10,
    classification: "blunder",
    tag: "hung_piece",
    phase: "opening",
    ...fields,
  } as MoveRecord;
}

test("a qualifying blunder: position before the move, best move first, 6 plies of the best line", () => {
  const [p] = puzzlesOfGame("g1", [move()], "w");
  assert.equal(p.id, puzzleId("g1", 1));
  assert.equal(p.fen, WHITE_TO_MOVE);
  assert.deepEqual(p.solution, ["e2e4"]);
  assert.deepEqual(p.bestLine, ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"]);
  assert.ok(Math.abs(p.bestEp - 0.6) < 1e-9);
  assert.equal(p.playedSan, "a3");
  assert.equal(p.tag, "hung_piece");
});

test("rules: only my Mistakes, Blunders and Misses with a different, not hopeless best move", () => {
  assert.equal(puzzlesOfGame("g", [move()], undefined).length, 0, "no known colour");
  assert.equal(puzzlesOfGame("g", [move()], "b").length, 0, "not my move");
  for (const cls of ["inaccuracy", "good", "best", "book"] as const) {
    assert.equal(puzzlesOfGame("g", [move({ classification: cls })], "w").length, 0, cls);
  }
  for (const cls of ["mistake", "miss", "blunder"] as const) {
    assert.equal(puzzlesOfGame("g", [move({ classification: cls })], "w").length, 1, cls);
  }
  assert.equal(puzzlesOfGame("g", [move({ bestLine: undefined })], "w").length, 0, "no best move");
  assert.equal(puzzlesOfGame("g", [move({ uci: " E2E4 " })], "w").length, 0, "best move = played move");
  assert.equal(puzzlesOfGame("g", [move({ fenBefore: BLACK_TO_MOVE })], "w").length, 0, "not my turn");
});

test("lost anyway: best EP under 0.15, or a forced mate for the opponent; a mate for me is fine", () => {
  const withBest = (line: { cp?: number; mate?: number }) => move({ bestLine: { ...line, pv: ["e2e4"] } });
  assert.equal(puzzlesOfGame("g", [withBest({ cp: cpFor(0.149) })], "w").length, 0);
  assert.equal(puzzlesOfGame("g", [withBest({ cp: cpFor(0.151) })], "w").length, 1);
  assert.equal(puzzlesOfGame("g", [withBest({ mate: -3 })], "w").length, 0);
  assert.equal(puzzlesOfGame("g", [withBest({ mate: 2 })], "w").length, 1);
});

test("solution list: the second line joins when within 0.02 EP (inclusive) and a different move", () => {
  const withSecond = (ep: number, pv0 = "d2d4") => move({ secondLine: { cp: cpFor(ep), pv: [pv0] } });
  assert.deepEqual(puzzlesOfGame("g", [withSecond(0.58)], "w")[0].solution, ["e2e4", "d2d4"]);
  assert.deepEqual(puzzlesOfGame("g", [withSecond(0.5799)], "w")[0].solution, ["e2e4"]);
  assert.deepEqual(puzzlesOfGame("g", [withSecond(0.6, "e2e4")], "w")[0].solution, ["e2e4"]);
});

test("at most 6 per game: the largest EP losses (ties: earlier ply), stored in game order", () => {
  const losses = [0.15, 0.4, 0.15, 0.3, 0.25, 0.5, 0.35, 0.15];
  const moves = losses.map((epLoss, i) => move({ ply: i * 2 + 1, epLoss }));
  assert.deepEqual(
    puzzlesOfGame("g", moves, "w").map((p) => p.ply),
    [1, 3, 7, 9, 11, 13],
  );
});

test("puzzleId: the first 16 hex characters of SHA-1 of '<game id>#<ply>'", () => {
  assert.equal(puzzleId("abc", 12), createHash("sha1").update("abc#12").digest("hex").slice(0, 16));
  assert.match(puzzleId("abc", 12), /^[0-9a-f]{16}$/);
});
