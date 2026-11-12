/**
 * Stored puzzles: content from the game's analysis plus the schedule, kept in step with re-analysis.
 */
import type Database from "better-sqlite3";
import { getAnalysis, getGame, listGames } from "../db.ts";
import { puzzlesOfGame, type PuzzleContent } from "./select.ts";
import { newSchedule, type Schedule } from "./schedule.ts";

export interface Puzzle extends PuzzleContent, Schedule {
  /** When the game was played (ordering and the provenance line). */
  playedAt: number;
  createdAt: number;
}

interface Row {
  id: string;
  data_json: string;
  due_at: number | null;
  interval_days: number;
  attempts: number;
  last_result: "solved" | "missed" | null;
  created_at: number;
  played_at: number;
}

const fromRow = (r: Row): Puzzle => ({
  ...(JSON.parse(r.data_json) as PuzzleContent),
  dueAt: r.due_at ?? undefined,
  intervalDays: r.interval_days,
  attempts: r.attempts,
  lastResult: r.last_result ?? undefined,
  createdAt: r.created_at,
  playedAt: r.played_at,
});

export function listPuzzles(db: Database.Database): Puzzle[] {
  return (db.prepare(`select * from puzzles`).all() as Row[]).map(fromRow);
}

export function getPuzzle(db: Database.Database, id: string): Puzzle | undefined {
  const row = db.prepare(`select * from puzzles where id = ?`).get(id) as Row | undefined;
  return row && fromRow(row);
}

export function saveSchedule(db: Database.Database, id: string, s: Schedule): void {
  db.prepare(`update puzzles set due_at = ?, interval_days = ?, attempts = ?, last_result = ? where id = ?`).run(
    s.dueAt ?? null,
    s.intervalDays,
    s.attempts,
    s.lastResult ?? null,
    id,
  );
}

export interface SyncResult {
  created: number;
  updated: number;
  removed: number;
}

/**
 * Reconciles one game's puzzles with its stored analysis, atomically: missing ones are created due at once;
 * present ones keep their schedule and get fresh content; ones no longer wanted are removed unless attempted.
 */
export function syncGamePuzzles(db: Database.Database, gameId: string, now: number): SyncResult {
  const game = getGame(db, gameId);
  const analysis = game && getAnalysis(db, gameId);
  const wanted = analysis ? puzzlesOfGame(gameId, analysis.analysis.moves, game.myColour) : [];
  const result = { created: 0, updated: 0, removed: 0 };
  db.transaction(() => {
    const present = new Map(
      (db.prepare(`select id, data_json, attempts from puzzles where game_id = ?`).all(gameId) as Pick<Row, "id" | "data_json" | "attempts">[]).map(
        (r) => [r.id, r],
      ),
    );
    for (const content of wanted) {
      const json = JSON.stringify(content);
      const row = present.get(content.id);
      present.delete(content.id);
      if (!row) {
        const s = newSchedule(now);
        db.prepare(
          `insert into puzzles (id, game_id, data_json, due_at, interval_days, attempts, last_result, created_at, played_at)
           values (?, ?, ?, ?, ?, ?, null, ?, ?)`,
        ).run(content.id, gameId, json, s.dueAt, s.intervalDays, s.attempts, now, game!.playedAt);
        result.created++;
      } else if (row.data_json !== json) {
        db.prepare(`update puzzles set data_json = ? where id = ?`).run(json, content.id);
        result.updated++;
      }
    }
    for (const stale of present.values()) {
      if (stale.attempts > 0) continue;
      db.prepare(`delete from puzzles where id = ?`).run(stale.id);
      result.removed++;
    }
  })();
  return result;
}

/** Every game's puzzles at once ("Refresh puzzles", a change of usernames). */
export function syncAllPuzzles(db: Database.Database, now: number): SyncResult & { total: number } {
  const sum = { created: 0, updated: 0, removed: 0 };
  for (const game of listGames(db)) {
    const r = syncGamePuzzles(db, game.id, now);
    sum.created += r.created;
    sum.updated += r.updated;
    sum.removed += r.removed;
  }
  const { total } = db.prepare(`select count(*) as total from puzzles`).get() as { total: number };
  return { ...sum, total };
}
