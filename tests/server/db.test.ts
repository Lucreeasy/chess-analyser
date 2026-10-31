import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, insertGames, listGames, getStoredEtag, putStoredEtag, deleteStoredEtag } from "../../src/server/db.ts";
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

// docs/03-IMPORT-SPEC.md section 3.6: a stored ETag is per (username, month).
test("stored ETags: get, put (replace) and delete, keyed by username and month", () => {
  const db = openDb(":memory:");
  assert.equal(getStoredEtag(db, "bc_tester", "2026-09"), undefined);

  putStoredEtag(db, "bc_tester", "2026-09", '"abc"', 1000);
  assert.equal(getStoredEtag(db, "bc_tester", "2026-09"), '"abc"');
  assert.equal(getStoredEtag(db, "bc_tester", "2026-08"), undefined); // a different month
  assert.equal(getStoredEtag(db, "other_user", "2026-09"), undefined); // a different username

  putStoredEtag(db, "bc_tester", "2026-09", '"def"', 2000); // a later fetch replaces it
  assert.equal(getStoredEtag(db, "bc_tester", "2026-09"), '"def"');

  deleteStoredEtag(db, "bc_tester", "2026-09");
  assert.equal(getStoredEtag(db, "bc_tester", "2026-09"), undefined);
});
