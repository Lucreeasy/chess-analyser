import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, insertGames, upsertQueueEntry, setQueueEntryRunning, finishAnalysis, recordAnalysisError } from "../../../src/server/db.ts";
import { toGameListRow } from "../../../src/server/games/listRows.ts";
import type { StoredGame } from "../../../src/server/import/parseGame.ts";
import type { GameAnalysis } from "../../../src/server/analysis/game.ts";

function game(overrides: Partial<StoredGame>): StoredGame {
  return {
    id: "a",
    source: "file",
    pgn: "1. e4",
    tags: {},
    white: "alice",
    black: "bob",
    whiteElo: 1500,
    blackElo: 1600,
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

function fakeAnalysis(accuracy: number, blunders: number): GameAnalysis {
  const counts = { book: 0, brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: blunders };
  return {
    moves: [],
    summary: {
      engine: "FakeEngine",
      depth: 16,
      analysedAt: 1,
      accuracy: { w: accuracy, b: 0 },
      counts: { w: counts, b: counts },
      phaseAccuracy: { w: {}, b: {} },
      maxEp: { w: 0, b: 0 },
      minEp: { w: 0, b: 0 },
      keyMoments: [],
    },
  };
}

test("opponent and opponentRating: the other side, from my colour", () => {
  const db = openDb(":memory:");
  const g = game({ id: "a", myColour: "w" });
  insertGames(db, [g]);
  const row = toGameListRow(db, g);
  assert.equal(row.opponent, "bob");
  assert.equal(row.opponentRating, 1600);
});

test("opponent is undefined when my colour is unknown", () => {
  const db = openDb(":memory:");
  const g = game({ id: "a", myColour: undefined });
  insertGames(db, [g]);
  const row = toGameListRow(db, g);
  assert.equal(row.opponent, undefined);
  assert.equal(row.opponentRating, undefined);
});

test("analysisStatus: none, queued (waiting), running, done, error", () => {
  const db = openDb(":memory:");
  const games = [
    game({ id: "a", myColour: "w" }),
    game({ id: "b", myColour: "w" }),
    game({ id: "c", myColour: "w" }),
    game({ id: "d", myColour: "w" }),
    game({ id: "e", myColour: "w" }),
  ];
  insertGames(db, games);
  upsertQueueEntry(db, "b", "standard", false, false, 1);
  upsertQueueEntry(db, "c", "standard", false, false, 1);
  setQueueEntryRunning(db, "c", true);
  finishAnalysis(db, "d", "standard", fakeAnalysis(91.2, 1), 1);
  recordAnalysisError(db, "e", "boom", 1);

  assert.equal(toGameListRow(db, games[0]!).analysisStatus, "none");
  assert.equal(toGameListRow(db, games[1]!).analysisStatus, "queued");
  assert.equal(toGameListRow(db, games[2]!).analysisStatus, "running");
  assert.equal(toGameListRow(db, games[3]!).analysisStatus, "done");
  assert.equal(toGameListRow(db, games[4]!).analysisStatus, "error");
});

test("accuracy and blunders: only present for a done game with a known colour", () => {
  const db = openDb(":memory:");
  const g = game({ id: "a", myColour: "w" });
  insertGames(db, [g]);
  finishAnalysis(db, "a", "standard", fakeAnalysis(91.2, 1), 1);

  const row = toGameListRow(db, g);
  assert.equal(row.accuracy, 91.2);
  assert.equal(row.blunders, 1);
});

test("accuracy and blunders are undefined for an unanalysed game", () => {
  const db = openDb(":memory:");
  const g = game({ id: "a", myColour: "w" });
  insertGames(db, [g]);
  const row = toGameListRow(db, g);
  assert.equal(row.accuracy, undefined);
  assert.equal(row.blunders, undefined);
});
