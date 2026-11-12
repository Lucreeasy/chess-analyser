import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, insertGames, upsertQueueEntry, setQueueEntryRunning, finishAnalysis, recordAnalysisError } from "../../../src/server/db.ts";
import { toGameReviewRow } from "../../../src/server/games/reviewRow.ts";
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

function fakeAnalysis(): GameAnalysis {
  const counts = { book: 0, brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 0 };
  return {
    moves: [],
    summary: {
      engine: "FakeEngine",
      depth: 16,
      analysedAt: 1,
      accuracy: { w: 91.2, b: 50 },
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
  const row = toGameReviewRow(db, g);
  assert.equal(row.opponent, "bob");
  assert.equal(row.opponentRating, 1600);
});

test("positions: the board positions from replaying the stored PGN", () => {
  const db = openDb(":memory:");
  const g = game({ id: "a", myColour: "w", pgn: "1. e4 e5 2. Nf3" });
  insertGames(db, [g]);
  const row = toGameReviewRow(db, g);
  assert.equal(row.positions.failure, undefined);
  assert.equal(row.positions.fens.length, 4); // start + 3 plies
});

test("analysisStatus and analysis/depth: only present once done", () => {
  const db = openDb(":memory:");
  const g = game({ id: "a", myColour: "w" });
  insertGames(db, [g]);

  const beforeRow = toGameReviewRow(db, g);
  assert.equal(beforeRow.analysisStatus, "none");
  assert.equal(beforeRow.analysis, undefined);
  assert.equal(beforeRow.depth, undefined);

  finishAnalysis(db, "a", "deep", fakeAnalysis(), 1);
  const afterRow = toGameReviewRow(db, g);
  assert.equal(afterRow.analysisStatus, "done");
  assert.equal(afterRow.depth, "deep");
  assert.equal(afterRow.analysis?.summary.accuracy.w, 91.2);
});

test("analysisStatus: queued and running, mirroring the queue", () => {
  const db = openDb(":memory:");
  const games = [game({ id: "a", myColour: "w" }), game({ id: "b", myColour: "w" })];
  insertGames(db, games);
  upsertQueueEntry(db, "a", "standard", false, false, 1);
  upsertQueueEntry(db, "b", "standard", false, false, 1);
  setQueueEntryRunning(db, "b", true);

  assert.equal(toGameReviewRow(db, games[0]!).analysisStatus, "queued");
  assert.equal(toGameReviewRow(db, games[1]!).analysisStatus, "running");
});

test("errorMessage: only present when analysisStatus is error", () => {
  const db = openDb(":memory:");
  const g = game({ id: "a", myColour: "w" });
  insertGames(db, [g]);
  recordAnalysisError(db, "a", "the engine crashed", 1);

  const row = toGameReviewRow(db, g);
  assert.equal(row.analysisStatus, "error");
  assert.equal(row.errorMessage, "the engine crashed");
});

test("analysis: a re-analysed game keeps its old analysis while queued/running", () => {
  const db = openDb(":memory:");
  const g = game({ id: "a", myColour: "w" });
  insertGames(db, [g]);
  finishAnalysis(db, "a", "standard", fakeAnalysis(), 1);

  upsertQueueEntry(db, "a", "deep", true, true, 2);
  const queuedRow = toGameReviewRow(db, g);
  assert.equal(queuedRow.analysisStatus, "queued");
  assert.equal(queuedRow.analysis?.summary.accuracy.w, 91.2);

  setQueueEntryRunning(db, "a", true);
  const runningRow = toGameReviewRow(db, g);
  assert.equal(runningRow.analysisStatus, "running");
  assert.equal(runningRow.analysis?.summary.accuracy.w, 91.2);
});

test("errorMessage is undefined for a game with no error", () => {
  const db = openDb(":memory:");
  const g = game({ id: "a", myColour: "w" });
  insertGames(db, [g]);
  assert.equal(toGameReviewRow(db, g).errorMessage, undefined);
});
