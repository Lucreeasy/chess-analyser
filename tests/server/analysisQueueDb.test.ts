import { test } from "node:test";
import assert from "node:assert/strict";
import {
  openDb,
  insertGames,
  getQueueEntry,
  upsertQueueEntry,
  removeQueueEntry,
  setQueueEntryRunning,
  clearRunningFlags,
  listQueueOrdered,
  getAnalysis,
  getAnalysisError,
  finishAnalysis,
  recordAnalysisError,
  getQueueState,
  setPaused,
  resetDoneCount,
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

test("queue entries: get, upsert (insert), remove", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  assert.equal(getQueueEntry(db, "a"), undefined);

  upsertQueueEntry(db, "a", "standard", false, false, 1000);
  const entry = getQueueEntry(db, "a");
  assert.equal(entry?.gameId, "a");
  assert.equal(entry?.depth, "standard");
  assert.equal(entry?.force, false);
  assert.equal(entry?.urgent, false);
  assert.equal(entry?.requestedAt, 1000);
  assert.equal(entry?.running, false);

  removeQueueEntry(db, "a");
  assert.equal(getQueueEntry(db, "a"), undefined);
});

test("upsertQueueEntry on an already-waiting game updates depth/force/urgent, keeps requestedAt and running", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  upsertQueueEntry(db, "a", "quick", false, false, 1000);
  setQueueEntryRunning(db, "a", true);

  upsertQueueEntry(db, "a", "deep", true, true, 2000); // a later, urgent, forced, deeper request
  const entry = getQueueEntry(db, "a");
  assert.equal(entry?.depth, "deep");
  assert.equal(entry?.force, true);
  assert.equal(entry?.urgent, true);
  assert.equal(entry?.requestedAt, 1000); // unchanged: the original request order
  assert.equal(entry?.running, true); // unchanged
});

test("clearRunningFlags puts every running entry back to waiting", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" }), game({ id: "b" })]);
  upsertQueueEntry(db, "a", "standard", false, false, 1);
  upsertQueueEntry(db, "b", "standard", false, false, 2);
  setQueueEntryRunning(db, "a", true);

  clearRunningFlags(db);
  assert.equal(getQueueEntry(db, "a")?.running, false);
  assert.equal(getQueueEntry(db, "b")?.running, false);
});

// docs/03-IMPORT-SPEC.md section 5.4: urgent first, then newest game first, then request order, then id.
test("listQueueOrdered: urgent before bulk, then newest playedAt, then request order, then game id", () => {
  const db = openDb(":memory:");
  insertGames(db, [
    game({ id: "old", playedAt: 1 }),
    game({ id: "new", playedAt: 2 }),
    game({ id: "urgent-game", playedAt: 1 }),
    game({ id: "tie-a", playedAt: 1 }),
    game({ id: "tie-b", playedAt: 1 }),
  ]);
  upsertQueueEntry(db, "old", "standard", false, false, 100);
  upsertQueueEntry(db, "new", "standard", false, false, 200);
  upsertQueueEntry(db, "urgent-game", "standard", false, true, 300);
  upsertQueueEntry(db, "tie-a", "standard", false, false, 50);
  upsertQueueEntry(db, "tie-b", "standard", false, false, 50); // same playedAt and requestedAt: tie-break by id

  const order = listQueueOrdered(db).map((e) => e.gameId);
  assert.deepEqual(order, ["urgent-game", "new", "tie-a", "tie-b", "old"]); // tie-a/tie-b requested earlier (50) than old (100)
});

test("analyses: get before/after finishAnalysis; it replaces an older analysis", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  upsertQueueEntry(db, "a", "standard", false, false, 1);

  assert.equal(getAnalysis(db, "a"), undefined);
  finishAnalysis(db, "a", "standard", fakeAnalysis(), 1000);

  const stored = getAnalysis(db, "a");
  assert.equal(stored?.depth, "standard");
  assert.equal(stored?.finishedAt, 1000);
  assert.deepEqual(stored?.analysis, fakeAnalysis());
  assert.equal(getQueueEntry(db, "a"), undefined); // the queue entry is gone

  finishAnalysis(db, "a", "deep", fakeAnalysis(), 2000); // a re-analysis replaces it
  assert.equal(getAnalysis(db, "a")?.depth, "deep");
});

test("finishAnalysis increments the done counter", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  assert.equal(getQueueState(db).done, 0);
  finishAnalysis(db, "a", "standard", fakeAnalysis(), 1000);
  assert.equal(getQueueState(db).done, 1);
});

test("recordAnalysisError removes the queue entry without touching the done counter", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  upsertQueueEntry(db, "a", "standard", false, false, 1);

  recordAnalysisError(db, "a", "engine unavailable: boom", 1000);
  assert.equal(getQueueEntry(db, "a"), undefined);
  assert.equal(getAnalysisError(db, "a"), "engine unavailable: boom");
  assert.equal(getQueueState(db).done, 0);
});

test("finishAnalysis clears a stale error for the same game", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  recordAnalysisError(db, "a", "boom", 1);
  finishAnalysis(db, "a", "standard", fakeAnalysis(), 2);
  assert.equal(getAnalysisError(db, "a"), undefined);
});

test("queue state: paused and done default to false/0, round-trip, and done can be reset", () => {
  const db = openDb(":memory:");
  assert.deepEqual(getQueueState(db), { paused: false, done: 0 });

  setPaused(db, true);
  assert.equal(getQueueState(db).paused, true);
  setPaused(db, false);
  assert.equal(getQueueState(db).paused, false);

  finishAnalysis(db, "a", "standard", fakeAnalysis(), 1);
  assert.equal(getQueueState(db).done, 1);
  resetDoneCount(db);
  assert.equal(getQueueState(db).done, 0);
});
