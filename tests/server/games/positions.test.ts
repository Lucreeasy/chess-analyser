import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { splitIntoGames } from "../../../src/server/import/pgnText.ts";
import { positionsOf } from "../../../src/server/games/positions.ts";

const SAMPLES = new URL("../../../../reference/pgn-samples/", import.meta.url);
function sample(name: string): string {
  return readFileSync(new URL(name, SAMPLES), "utf8");
}

test("positionsOf: one FEN per ply plus the start position, for a clean game", () => {
  const [gameText] = splitIntoGames(sample("annotations.pgn"));
  const result = positionsOf(gameText!);
  assert.equal(result.failure, undefined);
  assert.equal(result.fens[0], "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  assert.ok(result.fens.length > 1);
});

test("positionsOf: lastMoves holds the from/to squares, undefined at the start position", () => {
  const [gameText] = splitIntoGames(sample("annotations.pgn"));
  const result = positionsOf(gameText!);
  assert.equal(result.lastMoves.length, result.fens.length);
  assert.equal(result.lastMoves[0], undefined);
  assert.equal(result.lastMoves[1], "e2e4"); // the game's first move
});

test("positionsOf: sans holds the move text, undefined at the start position", () => {
  const [gameText] = splitIntoGames(sample("annotations.pgn"));
  const result = positionsOf(gameText!);
  assert.equal(result.sans.length, result.fens.length);
  assert.equal(result.sans[0], undefined);
  assert.equal(result.sans[1], "e4"); // the game's first move
});

test("positionsOf: a late illegal move reports the failure but keeps the positions reached so far", () => {
  const games = splitIntoGames(sample("late-illegal.pgn"));
  const result = positionsOf(games[1]!); // "20. e1" is unplayable
  assert.ok(result.failure);
  assert.ok(result.fens.length > 1);
});

test("positionsOf: an unreadable starting position reports the failure with no positions", () => {
  const result = positionsOf('[Event "e"]\n[FEN "not a fen"]\n[SetUp "1"]\n\n1. e4 *');
  assert.ok(result.failure?.startsWith('Invalid starting position in FEN header "not a fen"'));
  assert.deepEqual(result.fens, []);
});
