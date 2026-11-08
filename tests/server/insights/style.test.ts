import { test } from "node:test";
import assert from "node:assert/strict";
import { styleFeatures } from "../../../src/server/insights/style.ts";
import { used } from "./fixtures.ts";

const close = (actual: number | undefined, expected: number) => assert.ok(Math.abs((actual ?? NaN) - expected) < 0.005, `${actual} != ${expected}`);
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const KING_G8 = "6k1/8/8/8/6P1/8/8/4K3 w - - 0 1";
const move = (san: string, uci: string, fenBefore = START) => ({ san, uci, fenBefore, winPercentBefore: 50, winPercentAfter: 50 });
/** A quiet opponent move between mine. */
const reply = move("a6", "a7a6");

test("11: a capturing check counts twice for checks + captures per move", () => {
  const s = styleFeatures([used("a", { moves: [move("Nxe5+", "f3e5"), reply, move("e4", "e2e4"), reply, move("Qxf7#", "h5f7"), reply] })]);
  assert.deepEqual(s.checksCaptures, { value: 4 / 3, n: 3, count: 4 });
});

test("11: opponent half is rank 5+ for White; a pawn storm lands there within 2 files of the enemy king", () => {
  const s = styleFeatures([
    used("a", {
      moves: [move("g5", "g4g5", KING_G8), reply, move("e4", "e2e4"), reply, move("a5", "a4a5", KING_G8), reply, move("Nf5", "d4f5", KING_G8), reply],
    }),
  ]);
  assert.deepEqual(s.opponentHalf, { value: 0.75, n: 4, count: 3 });
  assert.deepEqual(s.pawnStorm, { value: 0.25, n: 4, count: 1 });
});

test("11: as Black the opponent half is rank 4 and below", () => {
  const black = { ...used("a", { moves: [reply, move("d4", "d5d4"), reply, move("e5", "e7e5")] }), me: "b" as const };
  assert.deepEqual(styleFeatures([black]).opponentHalf, { value: 0.5, n: 2, count: 1 });
});

test("11: opposite-side castling counts only games where both sides castled, each side's first castling", () => {
  const castles = (w: string, b?: string) => [move(w, "e1g1"), b ? move(b, "e8c8") : reply, move("O-O-O", "e1c1"), reply];
  const s = styleFeatures([used("a", { moves: castles("O-O", "O-O-O") }), used("b", { moves: castles("O-O", "O-O") }), used("c", { moves: castles("O-O") })]);
  assert.deepEqual(s.oppositeCastling, { value: 0.5, n: 2, count: 1 });
});

test("11 example: volatility over 10-position windows after my moves; short windows are skipped", () => {
  const wins = [50, 50, 60, 60, 70, 70, 80];
  const moves = wins.slice(1).map((w, i) => ({ ...move("a3", "a2a3"), winPercentBefore: wins[i], winPercentAfter: w }));
  const s = styleFeatures([used("a", { moves })]);
  close(s.volatility.value, 9.57);
  assert.equal(s.volatility.n, 1);
});

test("11: best-move rate counts Best, Great and Brilliant over my non-Book moves", () => {
  const classes = ["book", "best", "great", "good", "brilliant", "excellent"] as const;
  const s = styleFeatures([used("a", { moves: classes.flatMap((c) => [{ ...move("a3", "a2a3"), classification: c }, reply]) })]);
  assert.deepEqual(s.bestMoveRate, { value: 0.6, n: 5, count: 3 });
});
