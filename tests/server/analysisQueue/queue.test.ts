import { test } from "node:test";
import assert from "node:assert/strict";
import {
  openDb,
  insertGames,
  getQueueEntry,
  upsertQueueEntry,
  setQueueEntryRunning,
  finishAnalysis,
  recordAnalysisError,
  getQueueState,
  putSettings,
} from "../../../src/server/db.ts";
import { gameAnalysisState, unknownGameIds, enqueueGames, autoQueueNewGames } from "../../../src/server/analysisQueue/queue.ts";
import type { StoredGame } from "../../../src/server/import/parseGame.ts";
import type { GameAnalysis } from "../../../src/server/analysis/game.ts";
import { DEFAULT_SETTINGS } from "../../../src/server/settings.ts";

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

test("gameAnalysisState: none, waiting, running, done, error", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" }), game({ id: "b" }), game({ id: "c" }), game({ id: "d" }), game({ id: "e" })]);
  upsertQueueEntry(db, "b", "standard", false, false, 1);
  upsertQueueEntry(db, "c", "standard", false, false, 1);
  setQueueEntryRunning(db, "c", true);
  finishAnalysis(db, "d", "standard", fakeAnalysis(), 1);
  recordAnalysisError(db, "e", "boom", 1);

  assert.equal(gameAnalysisState(db, "a"), "none");
  assert.equal(gameAnalysisState(db, "b"), "waiting");
  assert.equal(gameAnalysisState(db, "c"), "running");
  assert.equal(gameAnalysisState(db, "d"), "done");
  assert.equal(gameAnalysisState(db, "e"), "error");
});

test("unknownGameIds: only ids that are not stored games", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  assert.deepEqual(unknownGameIds(db, ["a", "ghost"]), ["ghost"]);
  assert.deepEqual(unknownGameIds(db, ["a"]), []);
});

test("enqueueGames: a new game is queued; queued counts only new entries", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" }), game({ id: "b" })]);
  const queued = enqueueGames(db, ["a", "b"], "standard", false, false, 1000);
  assert.equal(queued, 2);
  assert.equal(getQueueEntry(db, "a")?.depth, "standard");
});

test("enqueueGames: a running game is left alone", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  upsertQueueEntry(db, "a", "quick", false, false, 1);
  setQueueEntryRunning(db, "a", true);

  const queued = enqueueGames(db, ["a"], "deep", true, true, 2000);
  assert.equal(queued, 0);
  const entry = getQueueEntry(db, "a");
  assert.equal(entry?.depth, "quick"); // untouched
  assert.equal(entry?.running, true);
});

test("enqueueGames: a done game is skipped unless forced", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  finishAnalysis(db, "a", "standard", fakeAnalysis(), 1);

  assert.equal(enqueueGames(db, ["a"], "standard", false, false, 1000), 0);
  assert.equal(getQueueEntry(db, "a"), undefined);

  assert.equal(enqueueGames(db, ["a"], "deep", true, false, 2000), 1);
  assert.equal(getQueueEntry(db, "a")?.depth, "deep");
});

test("enqueueGames: an already-waiting game is merged, not duplicated, and requestedAt is kept", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  enqueueGames(db, ["a"], "quick", false, false, 1000);

  const queued = enqueueGames(db, ["a"], "deep", true, true, 2000);
  assert.equal(queued, 0); // not a new entry
  const entry = getQueueEntry(db, "a");
  assert.equal(entry?.depth, "deep");
  assert.equal(entry?.force, true);
  assert.equal(entry?.urgent, true);
  assert.equal(entry?.requestedAt, 1000);
});

test("enqueueGames: an error game can be queued again", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  recordAnalysisError(db, "a", "boom", 1);

  assert.equal(enqueueGames(db, ["a"], "standard", false, false, 1000), 1);
  assert.equal(getQueueEntry(db, "a")?.depth, "standard");
});

// A request that adds at least one game to an empty queue starts a new batch.
test("enqueueGames: adding to an empty queue resets the done counter", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" }), game({ id: "b" }), game({ id: "c" })]);
  finishAnalysis(db, "a", "standard", fakeAnalysis(), 1); // done = 1, queue now empty again
  assert.equal(getQueueState(db).done, 1);

  enqueueGames(db, ["b"], "standard", false, false, 1000);
  assert.equal(getQueueState(db).done, 0); // the queue was empty: a new batch starts

  enqueueGames(db, ["c"], "standard", false, false, 2000); // the queue is not empty this time
  finishAnalysis(db, "b", "standard", fakeAnalysis(), 3000);
  assert.equal(getQueueState(db).done, 1);
});

test("enqueueGames: nothing actually queued does not reset the done counter", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  finishAnalysis(db, "a", "standard", fakeAnalysis(), 1);
  assert.equal(getQueueState(db).done, 1);

  enqueueGames(db, ["a"], "standard", false, false, 1000); // done, not forced: nothing queued
  assert.equal(getQueueState(db).done, 1);
});

// Every import that stores new games queues exactly those, bulk, at the default preset.
test("autoQueueNewGames: queues at the saved default depth, not urgent, not forced", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  putSettings(db, { ...DEFAULT_SETTINGS, autoAnalyse: true, depthPreset: "deep" });

  const queued = autoQueueNewGames(db, ["a"], 1000);
  assert.equal(queued, 1);
  const entry = getQueueEntry(db, "a");
  assert.equal(entry?.depth, "deep");
  assert.equal(entry?.force, false);
  assert.equal(entry?.urgent, false);
});

test("autoQueueNewGames: does nothing when autoAnalyse is off", () => {
  const db = openDb(":memory:");
  insertGames(db, [game({ id: "a" })]);
  putSettings(db, { ...DEFAULT_SETTINGS, autoAnalyse: false });

  assert.equal(autoQueueNewGames(db, ["a"], 1000), 0);
  assert.equal(getQueueEntry(db, "a"), undefined);
});

test("autoQueueNewGames: an empty list does nothing", () => {
  const db = openDb(":memory:");
  assert.equal(autoQueueNewGames(db, [], 1000), 0);
});
