/** Shapes and text for the import report card. docs/06-GAMES-SPEC.md section A12.4. */

export interface Failure {
  index: number;
  reason: string;
  snippet: string;
}

export interface MonthReport {
  month: string;
  status: "ok" | "not_found" | "rate_limited" | "error";
  message: string;
}

/** The response of POST api/games/import (file and paste tabs). */
export interface ImportApiResult {
  total: number;
  added: number;
  duplicates: number;
  failed: Failure[];
  gameIds: string[];
  queued: number;
}

export interface ImportReport {
  title: string;
  added: number;
  duplicates: number;
  failed: Failure[];
  queued: number;
  months?: MonthReport[];
}

export function summaryLine(added: number, duplicates: number, failedCount: number): string {
  return `${added} new, ${duplicates} duplicate${duplicates === 1 ? "" : "s"}, ${failedCount} failed`;
}

export function queuedLine(queued: number): string | undefined {
  return queued === 0 ? undefined : `${queued} game${queued === 1 ? "" : "s"} queued for analysis.`;
}

const MONTH_LABELS: Record<MonthReport["status"], string> = {
  ok: "Imported",
  not_found: "No games found",
  rate_limited: "Rate limited by chess.com",
  error: "Error",
};

export function monthLabel(status: MonthReport["status"]): string {
  return MONTH_LABELS[status];
}

const RATE_LIMITED_HINT =
  "chess.com asked us to slow down. Wait a minute, then import this month again (games already imported are skipped).";

export function monthMessage(report: MonthReport): string {
  return report.status === "rate_limited" ? RATE_LIMITED_HINT : report.message;
}

export function failedHeading(n: number): string {
  return `${n} failed game${n === 1 ? "" : "s"}: show reasons`;
}
