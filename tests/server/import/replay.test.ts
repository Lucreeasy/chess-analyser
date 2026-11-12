import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Chess } from "chess.js";
import { splitIntoGames, extractTags, movetextOf } from "../../../src/server/import/pgnText.ts";
import { tokenizeMovetext } from "../../../src/server/import/movetext.ts";
import { resolveStartPosition, replayGame } from "../../../src/server/import/replay.ts";

const SAMPLES = new URL("../../../../reference/pgn-samples/", import.meta.url);
function sample(name: string): string {
  return readFileSync(new URL(name, SAMPLES), "utf8");
}

function gamesOf(fileName: string): string[] {
  return splitIntoGames(sample(fileName));
}

function replay(gameText: string, fullReplay: boolean) {
  const tags = extractTags(gameText);
  const start = resolveStartPosition(tags);
  if (start.failure) return { plyCount: 0, failure: start.failure };
  const { moves } = tokenizeMovetext(movetextOf(gameText));
  return replayGame(start.fen, moves, fullReplay);
}

// The sample files' README.
test("malformed.pgn: game 2 fails at import with the exact message, its neighbours are fine", () => {
  const games = gamesOf("malformed.pgn");
  assert.equal(games.length, 3);
  const results = games.map((g) => replay(g, false));
  assert.equal(results[0].failure, undefined);
  assert.equal(results[0].plyCount, 31);
  assert.equal(results[1].failure, 'Illegal or unreadable move "Qxh7" at move 9. (White)');
  assert.equal(results[2].failure, undefined);
  assert.equal(results[2].plyCount, 31);
});

test("late-illegal.pgn: game 2's late illegal move is stored at import, fails only on full replay", () => {
  const games = gamesOf("late-illegal.pgn");
  assert.equal(games.length, 2);
  const atImport = replay(games[1], false);
  assert.equal(atImport.failure, undefined);
  assert.equal(atImport.plyCount, 60);

  const fullReplay = replay(games[1], true);
  assert.equal(fullReplay.failure, 'Illegal or unreadable move "e1" at move 20. (White)');
});

test("late-illegal.pgn: game 1 is fine at import and under full replay", () => {
  const games = gamesOf("late-illegal.pgn");
  assert.equal(replay(games[0], false).failure, undefined);
  assert.equal(replay(games[0], true).failure, undefined);
  assert.equal(replay(games[0], true).plyCount, 55);
});

test("non-standard-start.pgn: move numbers follow the FEN's own counter, Black to move first", () => {
  const games = gamesOf("non-standard-start.pgn");
  assert.equal(games.length, 2);
  // Game 2 starts at move 9, Black to move; confirm via resolveStartPosition.
  const tags = extractTags(games[1]);
  const start = resolveStartPosition(tags);
  assert.equal(start.failure, undefined);
  assert.equal(start.fen.split(" ")[1], "b");
  assert.equal(start.fen.split(" ")[5], "9");
  const result = replay(games[1], true);
  assert.equal(result.failure, undefined);
  assert.equal(result.plyCount, 42);
});

test("an unsupported variant fails the game", () => {
  const tags = new Map([["Variant", "Chess960"]]);
  assert.equal(
    resolveStartPosition(tags).failure,
    'Unsupported variant "Chess960": only standard chess is supported',
  );
});

test("Variant standard/chess/empty, any case, is accepted", () => {
  for (const v of ["", "standard", "STANDARD", "Chess"]) {
    assert.equal(resolveStartPosition(new Map([["Variant", v]])).failure, undefined);
  }
});

test('SetUp "0" ignores the FEN tag even when one is present', () => {
  const tags = new Map([
    ["FEN", "4k3/8/8/8/8/8/8/4K3 w - - 0 1"],
    ["SetUp", "0"],
  ]);
  const start = resolveStartPosition(tags);
  assert.match(start.fen, /^rnbqkbnr/); // the standard start, not the given FEN
});

test("an invalid FEN fails the game with the exact wrapper message", () => {
  const start = resolveStartPosition(new Map([["FEN", "garbage"]]));
  assert.match(start.failure!, /^Invalid starting position in FEN header "garbage": /);
});

test("a null move fails the game", () => {
  const result = replayGame(new Chess().fen(), [{ raw: "e4" }, { raw: "--" }], false);
  assert.equal(result.failure, 'Unsupported null move "--" at move 1... (Black)');
});
