import { parseGame, type StoredGame } from "./parseGame.ts";

/** The import report. docs/03-IMPORT-SPEC.md sections 2.17-2.18. */

export interface Failure {
  index: number;
  reason: string;
  snippet: string;
}

export interface ImportSummary {
  total: number;
  added: number;
  duplicates: number;
  failed: Failure[];
  gameIds: string[];
}

function snippetOf(gameText: string): string {
  return gameText.split("\n").slice(0, 6).join("\n").slice(0, 300);
}

/**
 * Parses every game text, drops repeats (within this batch or already
 * stored), and reports the result. Does not store anything or queue
 * analysis - the caller does that with `newGames` (one atomic write).
 */
export function importGames(
  gameTexts: string[],
  source: StoredGame["source"],
  usernames: string[],
  importMoment: number,
  alreadyStoredIds: Set<string>,
): { summary: ImportSummary; newGames: StoredGame[] } {
  const seenInBatch = new Set<string>();
  const newGames: StoredGame[] = [];
  const failed: Failure[] = [];
  let duplicates = 0;

  gameTexts.forEach((text, index) => {
    const result = parseGame(text, source, usernames, importMoment);
    if (result.failure) {
      failed.push({ index, reason: result.failure, snippet: snippetOf(text) });
      return;
    }
    const game = result.game!;
    if (seenInBatch.has(game.id) || alreadyStoredIds.has(game.id)) {
      duplicates++;
      return;
    }
    seenInBatch.add(game.id);
    newGames.push(game);
  });

  return {
    summary: { total: gameTexts.length, added: newGames.length, duplicates, failed, gameIds: newGames.map((g) => g.id) },
    newGames,
  };
}
