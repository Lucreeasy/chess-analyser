import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, insertGame, listGames } from "../../src/server/db.ts";

test("inserted games are listed newest first, duplicates ignored", () => {
  const db = openDb(":memory:");
  insertGame(db, { id: "a", white: "alice", black: "bob", result: "1-0", pgn: "1. e4", importedAt: 1 });
  insertGame(db, { id: "b", white: "carol", black: "dave", result: "0-1", pgn: "1. d4", importedAt: 2 });
  insertGame(db, { id: "a", white: "alice", black: "bob", result: "1-0", pgn: "1. e4", importedAt: 3 });

  const games = listGames(db);
  assert.equal(games.length, 2);
  assert.equal(games[0].id, "b");
  assert.equal(games[1].id, "a");
});
