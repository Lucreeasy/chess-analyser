import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, insertGames, listGames } from "../../src/server/db.ts";
import type { StoredGame } from "../../src/server/import/parseGame.ts";

function game(overrides: Partial<StoredGame>): StoredGame {
  return {
    id: "a",
    source: "file",
    pgn: "1. e4",
    tags: {},
    white: "alice",
    black: "bob",
    result: "1-0",
    timeControlText: "-",
    timeClass: "classical",
    playedAt: 1,
    plyCount: 1,
    importedAt: 1,
    analysisStatus: "none",
    ...overrides,
  };
}

test("inserted games are listed newest-played-first; first write wins per id", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a", playedAt: 1 }), game({ id: "b", white: "carol", playedAt: 2 })]);
  insertGames(db, [game({ id: "a", white: "someone-else", playedAt: 1 })]); // ignored: id already stored

  const games = listGames(db);
  assert.equal(games.length, 2);
  assert.equal(games[0].id, "b");
  assert.equal(games[1].id, "a");
  assert.equal(games[1].white, "alice"); // the first write, not the later one
});
