import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gameId } from "../../../src/server/import/identity.ts";
import { splitIntoGames, extractTags, movetextOf } from "../../../src/server/import/pgnText.ts";
import { tokenizeMovetext } from "../../../src/server/import/movetext.ts";

const SAMPLES = new URL("../../../../reference/pgn-samples/", import.meta.url);
function sample(name: string): string {
  return readFileSync(new URL(name, SAMPLES), "utf8");
}

test("the Link tag, trimmed, is the id when present", () => {
  const tags = new Map([["Link", "  https://www.chess.com/game/live/130000197975  "]]);
  assert.equal(gameId(tags, []), "https://www.chess.com/game/live/130000197975");
});

// The worked example.
test("worked example: tags B then A, moves e4 e5", () => {
  const tags = new Map([["B", "2"], ["A", "1"]]);
  const moves = [{ raw: "e4" }, { raw: "e5" }];
  const expected = createHash("sha1").update("A=1\nB=2\n\ne4 e5", "utf8").digest("hex");
  assert.equal(gameId(tags, moves), expected);
});

test("check/mate marks are stripped, castling-zero is rewritten to O-O, for the hash", () => {
  const tags = new Map<string, string>();
  const withMarks = gameId(tags, [{ raw: "Qh7#" }, { raw: "0-0" }]);
  const withoutMarks = gameId(tags, [{ raw: "Qh7" }, { raw: "O-O" }]);
  assert.equal(withMarks, withoutMarks);
});

test("two identical games without Link get the same id; a changed move gives a different one", () => {
  const tags = new Map([["White", "a"]]);
  const id1 = gameId(tags, [{ raw: "e4" }, { raw: "e5" }]);
  const id2 = gameId(tags, [{ raw: "e4" }, { raw: "e5" }]);
  assert.equal(id1, id2);
  const id3 = gameId(tags, [{ raw: "e4" }, { raw: "c5" }]);
  assert.notEqual(id1, id3);
});

test("duplicates.pgn: games 4 and 5, byte-identical and Link-less, hash to the documented id", () => {
  const games = splitIntoGames(sample("duplicates.pgn"));
  const idsOf = (game: string) => {
    const tags = extractTags(game);
    const { moves } = tokenizeMovetext(movetextOf(game));
    return gameId(tags, moves);
  };
  const id4 = idsOf(games[3]);
  const id5 = idsOf(games[4]);
  assert.equal(id4, id5);
  assert.equal(id4, "c530b0feead305d1d3d49e7395e472378fbf7096");
  assert.equal(id4.length, 40);
});

test("duplicates.pgn: games 1 and 3 share a Link, so share an id", () => {
  const games = splitIntoGames(sample("duplicates.pgn"));
  const idOf = (game: string) => gameId(extractTags(game), []);
  assert.equal(idOf(games[0]), idOf(games[2]));
});
