import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

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
    )
  `);
  return db;
}

export function insertGame(db: Database.Database, game: Game): void {
  db.prepare(
    `insert or ignore into games (id, white, black, result, pgn, imported_at)
     values (@id, @white, @black, @result, @pgn, @importedAt)`,
  ).run(game);
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
