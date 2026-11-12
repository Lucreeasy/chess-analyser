import type Database from "better-sqlite3";
import { getQueueEntry, upsertQueueEntry, getAnalysis, getAnalysisError, listGames, isQueueEmpty, resetDoneCount, getSettings } from "../db.ts";
import { mergeQueueValues, shouldQueue, type GameAnalysisState } from "./entryRules.ts";
import type { DepthPreset } from "../settings.ts";

/** Applying a queue request to the stored queue. */

export function gameAnalysisState(db: Database.Database, gameId: string): GameAnalysisState {
  const entry = getQueueEntry(db, gameId);
  if (entry) return entry.running ? "running" : "waiting";
  if (getAnalysis(db, gameId)) return "done";
  if (getAnalysisError(db, gameId)) return "error";
  return "none";
}

/** The ids in `gameIds` that are not stored games (rejected as "unknown game ids"). */
export function unknownGameIds(db: Database.Database, gameIds: string[]): string[] {
  const known = new Set(listGames(db).map((g) => g.id));
  return gameIds.filter((id) => !known.has(id));
}

/**
 * Queues each (already known) game id per the queue's entry rules,
 * merging with any already-waiting entry instead of duplicating it.
 * Returns the number of NEW entries, which is what "queued" counts.
 * Starts a new batch when at least one game is added to an
 * empty queue: the `done` counter resets to 0.
 */
export function enqueueGames(db: Database.Database, gameIds: string[], depth: DepthPreset, force: boolean, urgent: boolean, requestedAt: number): number {
  const wasEmpty = isQueueEmpty(db);
  let queued = 0;
  for (const gameId of gameIds) {
    if (!shouldQueue(gameAnalysisState(db, gameId), force)) continue;
    const existing = getQueueEntry(db, gameId);
    const merged = mergeQueueValues(existing, { depth, force, urgent });
    upsertQueueEntry(db, gameId, merged.depth, merged.force, merged.urgent, requestedAt);
    if (!existing) queued++;
  }
  if (wasEmpty && queued > 0) resetDoneCount(db);
  return queued;
}

/**
 * Queues newly-imported games at the saved default depth, bulk (section
 * 5.2): every import (file, paste, chess.com month, auto-sync) that
 * stores new games queues exactly those, only when "Analyse new games
 * automatically" is on. Does nothing for an empty list.
 */
export function autoQueueNewGames(db: Database.Database, newGameIds: string[], requestedAt: number): number {
  const settings = getSettings(db);
  if (!settings.autoAnalyse || newGameIds.length === 0) return 0;
  return enqueueGames(db, newGameIds, settings.depthPreset, false, false, requestedAt);
}
