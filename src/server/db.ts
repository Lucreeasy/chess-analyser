import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { EngineLineWithPv } from "./analysis/tacticTags.ts";
import type { StoredGame } from "./import/parseGame.ts";
import { DEFAULT_SETTINGS, type Settings, type DepthPreset } from "./settings.ts";
import type { GameAnalysis } from "./analysis/game.ts";

export function openDb(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    create table if not exists games (
      id text primary key,
      played_at integer not null,
      data_json text not null
    );
    create table if not exists eval_cache (
      epd text not null,
      depth integer not null,
      multipv integer not null,
      lines_json text not null,
      reached_depth integer not null,
      primary key (epd, depth, multipv)
    );
    create table if not exists chesscom_etags (
      username text not null,
      month text not null,
      etag text not null,
      fetched_at integer not null,
      primary key (username, month)
    );
    create table if not exists settings (
      id integer primary key check (id = 1),
      data_json text not null
    );
    create table if not exists analysis_queue (
      seq integer primary key autoincrement,
      game_id text not null unique,
      depth text not null,
      force integer not null,
      urgent integer not null,
      requested_at integer not null,
      running integer not null default 0
    );
    create table if not exists analyses (
      game_id text primary key,
      depth text not null,
      data_json text not null,
      finished_at integer not null
    );
    create table if not exists analysis_errors (
      game_id text primary key,
      message text not null,
      failed_at integer not null
    );
    create table if not exists queue_state (
      id integer primary key check (id = 1),
      paused integer not null default 0,
      done integer not null default 0
    );
    insert or ignore into queue_state (id, paused, done) values (1, 0, 0);
  `);
  return db;
}

/** Stores new games in one atomic write (section 2.13/2.17); first write wins per id. */
export function insertGames(db: Database.Database, games: StoredGame[]): void {
  const insert = db.prepare(`insert or ignore into games (id, played_at, data_json) values (?, ?, ?)`);
  const insertAll = db.transaction((toInsert: StoredGame[]) => {
    for (const game of toInsert) insert.run(game.id, game.playedAt, JSON.stringify(game));
  });
  insertAll(games);
}

export function listGames(db: Database.Database): StoredGame[] {
  const rows = db.prepare(`select data_json from games order by played_at desc`).all() as { data_json: string }[];
  return rows.map((row) => JSON.parse(row.data_json));
}

export function getGame(db: Database.Database, gameId: string): StoredGame | undefined {
  const row = db.prepare(`select data_json from games where id = ?`).get(gameId) as { data_json: string } | undefined;
  return row ? JSON.parse(row.data_json) : undefined;
}

/** Overwrites already-stored games in place, keyed by id (section 6: re-deriving colour/result). */
export function updateGames(db: Database.Database, games: StoredGame[]): void {
  const update = db.prepare(`update games set data_json = ? where id = ?`);
  const updateAll = db.transaction((toUpdate: StoredGame[]) => {
    for (const game of toUpdate) update.run(JSON.stringify(game), game.id);
  });
  updateAll(games);
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

/**
 * The stored ETag for one (lower-cased username, month), used only by
 * auto-sync's conditional requests. docs/03-IMPORT-SPEC.md section 3.6.
 */
export function getStoredEtag(db: Database.Database, username: string, month: string): string | undefined {
  const row = db.prepare(`select etag from chesscom_etags where username = ? and month = ?`).get(username, month) as
    | { etag: string }
    | undefined;
  return row?.etag;
}

export function putStoredEtag(db: Database.Database, username: string, month: string, etag: string, fetchedAt: number): void {
  db.prepare(`insert or replace into chesscom_etags (username, month, etag, fetched_at) values (?, ?, ?, ?)`).run(
    username,
    month,
    etag,
    fetchedAt,
  );
}

export function deleteStoredEtag(db: Database.Database, username: string, month: string): void {
  db.prepare(`delete from chesscom_etags where username = ? and month = ?`).run(username, month);
}

/** Settings that affect import and analysis. docs/03-IMPORT-SPEC.md section 6. There is only ever one row. */
export function getSettings(db: Database.Database): Settings {
  const row = db.prepare(`select data_json from settings where id = 1`).get() as { data_json: string } | undefined;
  return row ? JSON.parse(row.data_json) : DEFAULT_SETTINGS;
}

export function putSettings(db: Database.Database, settings: Settings): void {
  db.prepare(`insert or replace into settings (id, data_json) values (1, ?)`).run(JSON.stringify(settings));
}

/** The analysis queue. docs/03-IMPORT-SPEC.md sections 5.1, 5.4, 5.7. */
export interface QueueEntry {
  gameId: string;
  depth: DepthPreset;
  force: boolean;
  urgent: boolean;
  requestedAt: number;
  seq: number;
  running: boolean;
}

interface QueueRow {
  seq: number;
  game_id: string;
  depth: DepthPreset;
  force: number;
  urgent: number;
  requested_at: number;
  running: number;
}

function rowToQueueEntry(row: QueueRow): QueueEntry {
  return {
    gameId: row.game_id,
    depth: row.depth,
    force: row.force === 1,
    urgent: row.urgent === 1,
    requestedAt: row.requested_at,
    seq: row.seq,
    running: row.running === 1,
  };
}

export function getQueueEntry(db: Database.Database, gameId: string): QueueEntry | undefined {
  const row = db.prepare(`select * from analysis_queue where game_id = ?`).get(gameId) as QueueRow | undefined;
  return row ? rowToQueueEntry(row) : undefined;
}

/**
 * Inserts a new entry, or - if the game is already waiting - updates its
 * depth/force/urgent in place: `requestedAt` and the running flag are
 * left untouched on an update, since the entry's original request order
 * and running state do not change (section 5.4).
 */
export function upsertQueueEntry(db: Database.Database, gameId: string, depth: DepthPreset, force: boolean, urgent: boolean, requestedAt: number): void {
  db.prepare(
    `insert into analysis_queue (game_id, depth, force, urgent, requested_at, running) values (?, ?, ?, ?, ?, 0)
     on conflict(game_id) do update set depth = excluded.depth, force = excluded.force, urgent = excluded.urgent`,
  ).run(gameId, depth, force ? 1 : 0, urgent ? 1 : 0, requestedAt);
}

export function setQueueEntryRunning(db: Database.Database, gameId: string, running: boolean): void {
  db.prepare(`update analysis_queue set running = ? where game_id = ?`).run(running ? 1 : 0, gameId);
}

/** Start-up recovery: an entry left "running" by an interrupted process goes back to waiting. */
export function clearRunningFlags(db: Database.Database): void {
  db.prepare(`update analysis_queue set running = 0 where running = 1`).run();
}

/** The queue in analysis order (section 5.4): urgent first, then newest game first, then request order, then id. */
export function isQueueEmpty(db: Database.Database): boolean {
  const row = db.prepare(`select 1 from analysis_queue limit 1`).get();
  return row === undefined;
}

export function listQueueOrdered(db: Database.Database): QueueEntry[] {
  const rows = db
    .prepare(
      `select q.* from analysis_queue q join games g on g.id = q.game_id
       order by q.urgent desc, g.played_at desc, q.requested_at asc, q.game_id asc`,
    )
    .all() as QueueRow[];
  return rows.map(rowToQueueEntry);
}

export interface StoredAnalysis {
  depth: DepthPreset;
  analysis: GameAnalysis;
  finishedAt: number;
}

export function getAnalysis(db: Database.Database, gameId: string): StoredAnalysis | undefined {
  const row = db.prepare(`select depth, data_json, finished_at from analyses where game_id = ?`).get(gameId) as
    | { depth: DepthPreset; data_json: string; finished_at: number }
    | undefined;
  if (!row) return undefined;
  return { depth: row.depth, analysis: JSON.parse(row.data_json), finishedAt: row.finished_at };
}

export function getAnalysisError(db: Database.Database, gameId: string): string | undefined {
  const row = db.prepare(`select message from analysis_errors where game_id = ?`).get(gameId) as { message: string } | undefined;
  return row?.message;
}

/**
 * Finishes a game's analysis atomically (section 5.7): stores the
 * analysis (replacing any older one), removes the queue entry and any
 * stale error, and increments the batch's `done` counter - all in one
 * write, so a crash leaves either all of it or none of it done.
 */
export function finishAnalysis(db: Database.Database, gameId: string, depth: DepthPreset, analysis: GameAnalysis, finishedAt: number): void {
  const tx = db.transaction(() => {
    db.prepare(`insert or replace into analyses (game_id, depth, data_json, finished_at) values (?, ?, ?, ?)`).run(
      gameId,
      depth,
      JSON.stringify(analysis),
      finishedAt,
    );
    db.prepare(`delete from analysis_queue where game_id = ?`).run(gameId);
    db.prepare(`delete from analysis_errors where game_id = ?`).run(gameId);
    db.prepare(`update queue_state set done = done + 1 where id = 1`).run();
  });
  tx();
}

/** Removes the queue entry and records the error (section 5.9); does not increment `done`. */
export function recordAnalysisError(db: Database.Database, gameId: string, message: string, failedAt: number): void {
  const tx = db.transaction(() => {
    db.prepare(`delete from analysis_queue where game_id = ?`).run(gameId);
    db.prepare(`insert or replace into analysis_errors (game_id, message, failed_at) values (?, ?, ?)`).run(gameId, message, failedAt);
  });
  tx();
}

export interface QueueState {
  paused: boolean;
  done: number;
}

export function getQueueState(db: Database.Database): QueueState {
  const row = db.prepare(`select paused, done from queue_state where id = 1`).get() as { paused: number; done: number };
  return { paused: row.paused === 1, done: row.done };
}

export function setPaused(db: Database.Database, paused: boolean): void {
  db.prepare(`update queue_state set paused = ? where id = 1`).run(paused ? 1 : 0);
}

export function resetDoneCount(db: Database.Database): void {
  db.prepare(`update queue_state set done = 0 where id = 1`).run();
}

/**
 * Deletes games (and their analyses/queue entries/errors) atomically.
 * Returns how many were actually stored. docs/03-IMPORT-SPEC.md section
 * 5.10. Does not touch the running flag; the caller aborts the running
 * game first if it is among `gameIds`.
 */
export function deleteGames(db: Database.Database, gameIds: string[]): number {
  if (gameIds.length === 0) return 0;
  const placeholders = gameIds.map(() => "?").join(",");
  const tx = db.transaction((ids: string[]) => {
    const result = db.prepare(`delete from games where id in (${placeholders})`).run(...ids);
    db.prepare(`delete from analysis_queue where game_id in (${placeholders})`).run(...ids);
    db.prepare(`delete from analyses where game_id in (${placeholders})`).run(...ids);
    db.prepare(`delete from analysis_errors where game_id in (${placeholders})`).run(...ids);
    return result.changes;
  });
  return tx(gameIds);
}

/**
 * "Delete all data": every game, analysis, queue entry, error, cached
 * evaluation and stored ETag; settings are kept. Section 5.10.
 */
export function deleteAllData(db: Database.Database): void {
  const tx = db.transaction(() => {
    db.prepare(`delete from games`).run();
    db.prepare(`delete from analysis_queue`).run();
    db.prepare(`delete from analyses`).run();
    db.prepare(`delete from analysis_errors`).run();
    db.prepare(`delete from eval_cache`).run();
    db.prepare(`delete from chesscom_etags`).run();
    db.prepare(`update queue_state set done = 0 where id = 1`).run();
  });
  tx();
}
