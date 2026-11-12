import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tokenizeMovetext } from "../../../src/server/import/movetext.ts";
import { splitIntoGames, movetextOf } from "../../../src/server/import/pgnText.ts";

const SAMPLES = new URL("../../../../reference/pgn-samples/", import.meta.url);
function sample(name: string): string {
  return readFileSync(new URL(name, SAMPLES), "utf8");
}

function raws(text: string): string[] {
  return tokenizeMovetext(text).moves.map((m) => m.raw);
}

test("comments: brace, line (;), and escape lines (%)", () => {
  assert.deepEqual(raws("1. e4 {a comment} e5 ; rest of line\n2. Nf3"), ["e4", "e5", "Nf3"]);
  assert.deepEqual(raws("% this whole line is ignored\n1. e4 e5"), ["e4", "e5"]);
  assert.deepEqual(raws("1. e4 50% e5"), ["e4", "50%", "e5"]); // a % mid-line is not an escape
});

test("an unterminated brace comment swallows the rest of the text", () => {
  assert.deepEqual(raws("1. e4 e5 {unterminated 2. Nf3 Nc6"), ["e4", "e5"]);
});

test("variations: nested, with comments containing parens, ignored entirely", () => {
  assert.deepEqual(raws('1. e4 (1. d4 (1... d5 {a "quoted" (paren) comment}) d5) e5'), ["e4", "e5"]);
});

test("an unterminated variation swallows the rest; a stray ) is ignored", () => {
  assert.deepEqual(raws("1. e4 (1. d4 d5 2. c4 e5"), ["e4"]);
  assert.deepEqual(raws("1. e4) e5"), ["e4", "e5"]);
});

test("NAGs, suffix marks, and standalone evaluation symbols are all dropped", () => {
  assert.deepEqual(raws("1. e4! e5?! 2. Nf3!? $10 Nc6 $1 3. d4 +/- exd4 =/∞"), ["e4", "e5", "Nf3", "Nc6", "d4", "exd4"]);
});

test("move numbers in every form, including fused with the move", () => {
  assert.deepEqual(raws("1. e4 1... e5 2.Nf3 12... Nc6"), ["e4", "e5", "Nf3", "Nc6"]);
});

test("the game ends at the first result token; anything after is ignored", () => {
  assert.deepEqual(tokenizeMovetext("1. e4 e5 1-0 2. Nf3").result, "1-0");
  assert.deepEqual(raws("1. e4 e5 1-0 2. Nf3"), ["e4", "e5"]);
  assert.equal(tokenizeMovetext("1. e4 e5 ½-½").result, "1/2-1/2");
  assert.equal(tokenizeMovetext("1. e4 e5 *").result, "*");
  assert.equal(tokenizeMovetext("1. e4 e5").result, undefined);
});

test("lenient spellings are kept as written (chess.js corrects them on replay)", () => {
  assert.deepEqual(raws("1. e2e4 e7e5 2. 0-0 0-0-0 3. a8=Q gxh8=N"), ["e2e4", "e7e5", "0-0", "0-0-0", "a8=Q", "gxh8=N"]);
});

test("null moves are kept as tokens, not stripped, so the caller can reject them", () => {
  assert.deepEqual(raws("1. e4 -- 2. Nf3 Z0 3. Nc3 z0"), ["e4", "--", "Nf3", "Z0", "Nc3", "z0"]);
});

test("a clock comment is attached to the move it follows", () => {
  const { moves } = tokenizeMovetext("1. e4 {[%clk 0:03:00]} e5 {[%clk 0:02:59]}");
  assert.equal(moves[0].comment, "[%clk 0:03:00]");
  assert.equal(moves[1].comment, "[%clk 0:02:59]");
});

test("en passant marker e.p. is a separate, dropped token", () => {
  assert.deepEqual(raws("1. e4 d5 2. e5 f5 3. exf6 e.p."), ["e4", "d5", "e5", "f5", "exf6"]);
});

// The sample files, checked against their README's ply counts.
test("annotations.pgn: 41 and 40 plies, despite heavy annotation", () => {
  const games = splitIntoGames(sample("annotations.pgn"));
  assert.equal(games.length, 2);
  assert.equal(tokenizeMovetext(movetextOf(games[0])).moves.length, 41);
  assert.equal(tokenizeMovetext(movetextOf(games[1])).moves.length, 40);
});

test("special-moves.pgn: en passant, both-colour long castling, every promotion form", () => {
  const games = splitIntoGames(sample("special-moves.pgn"));
  const plyCounts = games.map((g) => tokenizeMovetext(movetextOf(g)).moves.length);
  assert.deepEqual(plyCounts, [41, 36, 31, 28, 33]);
});
