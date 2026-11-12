import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, insertGames, finishAnalysis, deleteGames, updateGames, getGame } from "../../../src/server/db.ts";
import { syncGamePuzzles, syncAllPuzzles, listPuzzles, saveSchedule, getPuzzle } from "../../../src/server/puzzles/store.ts";
import { afterAttempt } from "../../../src/server/puzzles/schedule.ts";
import { cpFromWinPercent } from "../../../src/server/analysis/winPercent.ts";
import type { MoveRecord } from "../../../src/server/analysis/game.ts";
import { makeGame, makeAnalysis } from "../insights/fixtures.ts";

const T0 = Date.UTC(2026, 10, 1, 12);
const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const cpFor = (ep: number) => cpFromWinPercent(ep * 100);

/** A White blunder at ply 1 whose second line is worth `secondEp` (best line 0.6). */
function blunder(secondEp: number, classification: MoveRecord["classification"] = "blunder"): Partial<MoveRecord> {
  return {
    san: "a3",
    uci: "a2a3",
    fenBefore: FEN,
    classification,
    epLoss: 0.3,
    tag: "hung_piece",
    phase: "opening",
    bestLine: { cp: cpFor(0.6), pv: ["e2e4", "e7e5"] },
    secondLine: { cp: cpFor(secondEp), pv: ["d2d4"] },
  };
}

function setUp(secondEp = 0.59) {
  const db = openDb(":memory:");
  insertGames(db, [makeGame({ id: "g", playedAt: T0 - 86_400_000 })]);
  finishAnalysis(db, "g", "standard", makeAnalysis({ moves: [blunder(secondEp)] }), T0);
  return db;
}

test("sync creates a puzzle due at once; a second sync changes nothing", () => {
  const db = setUp();
  assert.deepEqual(syncGamePuzzles(db, "g", T0), { created: 1, updated: 0, removed: 0 });
  const [p] = listPuzzles(db);
  assert.deepEqual([p.dueAt, p.intervalDays, p.attempts, p.lastResult, p.createdAt], [T0, 0, 0, undefined, T0]);
  assert.deepEqual(p.solution, ["e2e4", "d2d4"]);
  assert.equal(p.playedAt, T0 - 86_400_000);
  assert.deepEqual(syncGamePuzzles(db, "g", T0 + 1), { created: 0, updated: 0, removed: 0 });
});

test("a re-analysis refreshes the content but keeps the schedule and history", () => {
  const db = setUp();
  syncGamePuzzles(db, "g", T0);
  const [p] = listPuzzles(db);
  saveSchedule(db, p.id, afterAttempt(p, false, T0));
  finishAnalysis(db, "g", "deep", makeAnalysis({ moves: [blunder(0.5)] }), T0 + 10);
  assert.deepEqual(syncGamePuzzles(db, "g", T0 + 10), { created: 0, updated: 1, removed: 0 });
  const after = getPuzzle(db, p.id)!;
  assert.deepEqual(after.solution, ["e2e4"]);
  assert.deepEqual([after.attempts, after.lastResult, after.intervalDays, after.dueAt], [1, "missed", 1, T0 + 86_400_000]);
});

test("a puzzle that stops qualifying goes if untouched, stays if attempted", () => {
  const untouched = setUp();
  syncGamePuzzles(untouched, "g", T0);
  finishAnalysis(untouched, "g", "deep", makeAnalysis({ moves: [blunder(0.59, "inaccuracy")] }), T0);
  assert.deepEqual(syncGamePuzzles(untouched, "g", T0), { created: 0, updated: 0, removed: 1 });
  assert.equal(listPuzzles(untouched).length, 0);

  const attempted = setUp();
  syncGamePuzzles(attempted, "g", T0);
  const [p] = listPuzzles(attempted);
  saveSchedule(attempted, p.id, afterAttempt(p, true, T0));
  finishAnalysis(attempted, "g", "deep", makeAnalysis({ moves: [blunder(0.59, "inaccuracy")] }), T0);
  assert.deepEqual(syncGamePuzzles(attempted, "g", T0), { created: 0, updated: 0, removed: 0 });
  assert.equal(listPuzzles(attempted).length, 1);
});

test("usernames that match nobody remove every untouched puzzle (sync of all games)", () => {
  const db = setUp();
  syncAllPuzzles(db, T0);
  updateGames(db, [{ ...getGame(db, "g")!, myColour: undefined }]);
  assert.deepEqual(syncAllPuzzles(db, T0), { created: 0, updated: 0, removed: 1, total: 0 });
});

test("deleting a game deletes its puzzles, attempted or not", () => {
  const db = setUp();
  syncGamePuzzles(db, "g", T0);
  const [p] = listPuzzles(db);
  saveSchedule(db, p.id, afterAttempt(p, false, T0));
  deleteGames(db, ["g"]);
  assert.equal(listPuzzles(db).length, 0);
});
