import type { FetchLike, FetchMonthOptions } from "./client.ts";
import { fetchMonth } from "./client.ts";
import type { RequestPacer } from "./pacer.ts";
import { splitIntoGames } from "../import/pgnText.ts";
import { importGames } from "../import/report.ts";
import type { StoredGame } from "../import/parseGame.ts";
import type { TimeClass } from "../import/timeClass.ts";

/** Fetching and importing a range of months for one username. */

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
  /**
   * Auto-sync only: sends a stored ETag per month and keeps
   * it up to date. A 304 skips the month entirely. Manual import omits
   * this and always fetches in full.
   */
  etags?: {
    get: (month: string) => string | undefined;
    store: (month: string, etag: string) => void;
    clear: (month: string) => void;
  };
}

function stoppedMessage(retryAfterSeconds: number | undefined): string {
  const hint = retryAfterSeconds === undefined ? "" : ` (retry in about ${retryAfterSeconds} s)`;
  return `not fetched: stopped after chess.com rate limiting${hint}`;
}

/**
 * Fetches each month in order, parses and stores what is new, and reports
 * per month. A rate-limited month stops the import: every later month is
 * reported as rate_limited without being fetched. Other
 * month problems do not stop it.
 *
 * `options.etags` (auto-sync only) sends a stored ETag per
 * month and keeps it current: a 304 skips the month with no parsing; a
 * full fetch stores the new ETag only when every time class was imported
 * with no failures, and clears any stored ETag otherwise. Manual import
 * omits `etags` and always fetches in full.
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
  const { onProgress, etags, ...fetchOptions } = options;
  const reports: MonthReport[] = [];
  let added = 0;
  let duplicates = 0;
  let failed = 0;
  let stoppedAt: number | undefined;
  const allTimeClasses = timeClasses.size === 5;

  for (let i = 0; i < months.length; i++) {
    const month = months[i]!;
    onProgress?.({ username, month, done: i, total: months.length });

    if (stoppedAt !== undefined) {
      reports.push({ month, status: "rate_limited", message: stoppedMessage(stoppedAt) });
      continue;
    }

    const ifNoneMatch = etags?.get(month);
    const result = await fetchMonth(fetchImpl, pacer, username, month, { ...fetchOptions, ifNoneMatch });

    if (result.status === "rate_limited") {
      stoppedAt = result.retryAfterSeconds;
      reports.push({ month, status: "rate_limited", message: result.message });
      continue;
    }
    if (result.status !== "ok" || result.unchanged) {
      reports.push({ month, status: result.status, message: result.message });
      continue;
    }

    let monthFailed = 0;
    if (result.pgn !== undefined) {
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
      monthFailed = summary.failed.length;
      reports.push({ month, status: "ok", message: `${summary.added} new, ${summary.duplicates} duplicates, ${summary.failed.length} failed` });
    } else {
      reports.push({ month, status: "ok", message: result.message });
    }

    if (etags) {
      if (!allTimeClasses) etags.clear(month);
      else if (monthFailed === 0 && result.etag) etags.store(month, result.etag);
    }
  }

  if (months.length > 0) onProgress?.({ username, month: months[months.length - 1]!, done: months.length, total: months.length });

  return { months: reports, added, duplicates, failed };
}
