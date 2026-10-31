import { parseGame, type StoredGame } from "./parseGame.ts";
import { extractTags } from "./pgnText.ts";
import { classifyTimeControl, type TimeClass } from "./timeClass.ts";

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
 *
 * `timeClasses`, when given, filters by the game's real (parsed) time
 * class (section 3.7): games outside it are skipped silently, neither
 * counted nor reported, even when they fail to parse.
 */
export function importGames(
  gameTexts: string[],
  source: StoredGame["source"],
  usernames: string[],
  importMoment: number,
  alreadyStoredIds: Set<string>,
  timeClasses?: Set<TimeClass>,
): { summary: ImportSummary; newGames: StoredGame[] } {
  const seenInBatch = new Set<string>();
  const newGames: StoredGame[] = [];
  const failed: Failure[] = [];
  let duplicates = 0;
  let total = 0;

  gameTexts.forEach((text, index) => {
    if (timeClasses && !timeClasses.has(classifyTimeControl(extractTags(text).get("TimeControl")))) return;
    total++;
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
    summary: { total, added: newGames.length, duplicates, failed, gameIds: newGames.map((g) => g.id) },
    newGames,
  };
}
