import type { FetchLike, FetchMonthOptions } from "./client.ts";
import { fetchMonth } from "./client.ts";
import type { RequestPacer } from "./pacer.ts";
import { splitIntoGames } from "../import/pgnText.ts";
import { importGames } from "../import/report.ts";
import type { StoredGame } from "../import/parseGame.ts";
import type { TimeClass } from "../import/timeClass.ts";

/** Fetching and importing a range of months for one username. docs/03-IMPORT-SPEC.md sections 3.1, 3.5, 3.7, 3.8. */

export interface MonthReport {
  month: string;
  status: "ok" | "not_found" | "rate_limited" | "error";
  message: string;
}

export interface SyncResult {
  months: MonthReport[];
  added: number;
  duplicates: number;
  failed: number;
}

export interface SyncOptions extends Omit<FetchMonthOptions, "ifNoneMatch"> {
  onProgress?: (event: { username: string; month: string; done: number; total: number }) => void;
}

function stoppedMessage(retryAfterSeconds: number | undefined): string {
  const hint = retryAfterSeconds === undefined ? "" : ` (retry in about ${retryAfterSeconds} s)`;
  return `not fetched: stopped after chess.com rate limiting${hint}`;
}

/**
 * Fetches each month in order (manual import: never sends a conditional
 * request), parses and stores what is new, and reports per month. A
 * rate-limited month stops the import: every later month is reported as
 * rate_limited without being fetched (section 3.5). Other month problems
 * do not stop it.
 */
export async function syncMonths(
  fetchImpl: FetchLike,
  pacer: RequestPacer,
  username: string,
  months: string[],
  timeClasses: Set<TimeClass>,
  alreadyStoredIds: Set<string>,
  store: (newGames: StoredGame[]) => void,
  importMoment: number,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const { onProgress, ...fetchOptions } = options;
  const reports: MonthReport[] = [];
  let added = 0;
  let duplicates = 0;
  let failed = 0;
  let stoppedAt: number | undefined;

  for (let i = 0; i < months.length; i++) {
    const month = months[i]!;
    onProgress?.({ username, month, done: i, total: months.length });

    if (stoppedAt !== undefined) {
      reports.push({ month, status: "rate_limited", message: stoppedMessage(stoppedAt) });
      continue;
    }

    const result = await fetchMonth(fetchImpl, pacer, username, month, fetchOptions);
    if (result.status === "rate_limited") {
      stoppedAt = result.retryAfterSeconds;
      reports.push({ month, status: "rate_limited", message: result.message });
    } else if (result.status === "ok" && result.pgn !== undefined) {
      const { summary, newGames } = importGames(
        splitIntoGames(result.pgn),
        "chesscom_api",
        [username],
        importMoment,
        alreadyStoredIds,
        timeClasses,
      );
      for (const id of summary.gameIds) alreadyStoredIds.add(id);
      store(newGames);
      added += summary.added;
      duplicates += summary.duplicates;
      failed += summary.failed.length;
      reports.push({ month, status: "ok", message: `${summary.added} new, ${summary.duplicates} duplicates, ${summary.failed.length} failed` });
    } else {
      reports.push({ month, status: result.status, message: result.message });
    }
  }

  if (months.length > 0) onProgress?.({ username, month: months[months.length - 1]!, done: months.length, total: months.length });

  return { months: reports, added, duplicates, failed };
}
