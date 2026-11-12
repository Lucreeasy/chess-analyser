import { test } from "node:test";
import assert from "node:assert/strict";
import {
  openDb,
  insertGames,
  listGames,
  upsertQueueEntry,
  getQueueEntry,
  finishAnalysis,
  getAnalysis,
  recordAnalysisError,
  getAnalysisError,
  deleteGames,
  deleteAllData,
  putCachedEval,
  getCachedEval,
  putStoredEtag,
  getStoredEtag,
  getSettings,
  getQueueState,
} from "../../src/server/db.ts";
import type { StoredGame } from "../../src/server/import/parseGame.ts";
import type { GameAnalysis } from "../../src/server/analysis/game.ts";

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

function fakeAnalysis(): GameAnalysis {
  return { moves: [], summary: {} as GameAnalysis["summary"] };
}

test("deleteGames removes the game, its analysis, queue entry and error; returns how many were stored", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" }), game({ id: "b" }), game({ id: "c" })]);
  upsertQueueEntry(db, "a", "standard", false, false, 1);
  finishAnalysis(db, "b", "standard", fakeAnalysis(), 1);
  recordAnalysisError(db, "c", "boom", 1);

  const deleted = deleteGames(db, ["a", "b", "c", "ghost"]);
  assert.equal(deleted, 3); // "ghost" was never stored

  assert.deepEqual(listGames(db), []);
  assert.equal(getQueueEntry(db, "a"), undefined);
  assert.equal(getAnalysis(db, "b"), undefined);
  assert.equal(getAnalysisError(db, "c"), undefined);
});

test("deleteGames leaves other games and their queue/analysis state untouched", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" }), game({ id: "b" })]);
  upsertQueueEntry(db, "b", "deep", false, false, 1);

  deleteGames(db, ["a"]);
  assert.deepEqual(listGames(db).map((g) => g.id), ["b"]);
  assert.equal(getQueueEntry(db, "b")?.depth, "deep");
});

test("deleteGames with an empty list does nothing", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  assert.equal(deleteGames(db, []), 0);
  assert.equal(listGames(db).length, 1);
});

test("deleteAllData removes games, analyses, queue entries, errors, eval cache and ETags; keeps settings", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  upsertQueueEntry(db, "a", "standard", false, false, 1);
  finishAnalysis(db, "a", "standard", fakeAnalysis(), 1);
  putCachedEval(db, "epd1", 16, 2, [{ cp: 10, pv: ["e2e4"] }], 16);
  putStoredEtag(db, "bc_tester", "2026-09", '"abc"', 1);

  deleteAllData(db);

  assert.deepEqual(listGames(db), []);
  assert.equal(getQueueEntry(db, "a"), undefined);
  assert.equal(getAnalysis(db, "a"), undefined);
  assert.equal(getCachedEval(db, "epd1", 16, 2), undefined);
  assert.equal(getStoredEtag(db, "bc_tester", "2026-09"), undefined);
  assert.notEqual(getSettings(db), undefined); // settings are kept (default, since none were put)
});

test("deleteAllData resets the done counter", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  finishAnalysis(db, "a", "standard", fakeAnalysis(), 1);
  assert.equal(getQueueState(db).done, 1);

  deleteAllData(db);
  assert.equal(getQueueState(db).done, 0);
});
