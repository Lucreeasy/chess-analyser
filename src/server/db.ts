import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { EngineLineWithPv } from "./analysis/tacticTags.ts";

export interface Game {
  id: string;
  white: string;
  black: string;
  result: string;
  pgn: string;
  importedAt: number;
}

export function openDb(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    create table if not exists games (
      id text primary key,
      white text not null,
      black text not null,
      result text not null,
      pgn text not null,
      imported_at integer not null
    );
    create table if not exists eval_cache (
      epd text not null,
      depth integer not null,
      multipv integer not null,
      lines_json text not null,
      reached_depth integer not null,
      primary key (epd, depth, multipv)
    );
  `);
  return db;
}

export function insertGame(db: Database.Database, game: Game): void {
  db.prepare(
    `insert or ignore into games (id, white, black, result, pgn, imported_at)
     values (@id, @white, @black, @result, @pgn, @importedAt)`,
  ).run(game);
}

export interface CachedEval {
  lines: EngineLineWithPv[];
  reachedDepth: number;
}

/**
 * The evaluation cache. docs/02-ANALYSIS-SPEC.md section 16: keyed by
 * (EPD, requested depth, multipv); first write wins; never store an empty
 * or aborted result.
 */
export function getCachedEval(db: Database.Database, epd: string, depth: number, multipv: number): CachedEval | undefined {
  const row = db
    .prepare(`select lines_json, reached_depth from eval_cache where epd = ? and depth = ? and multipv = ?`)
    .get(epd, depth, multipv) as { lines_json: string; reached_depth: number } | undefined;
  if (!row) return undefined;
  return { lines: JSON.parse(row.lines_json), reachedDepth: row.reached_depth };
}

export function putCachedEval(
  db: Database.Database,
  epd: string,
  depth: number,
  multipv: number,
  lines: EngineLineWithPv[],
  reachedDepth: number,
): void {
  if (lines.length === 0) return;
  db.prepare(
    `insert or ignore into eval_cache (epd, depth, multipv, lines_json, reached_depth) values (?, ?, ?, ?, ?)`,
  ).run(epd, depth, multipv, JSON.stringify(lines), reachedDepth);
}

export function listGames(db: Database.Database): Game[] {
  const rows = db
    .prepare(
      `select id, white, black, result, pgn, imported_at as importedAt
       from games order by imported_at desc`,
    )
    .all() as Game[];
  return rows;
}
