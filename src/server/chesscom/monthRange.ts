/** Selecting which available months to fetch. */

/** Default From/To: To = newest available month, From = third newest (or oldest if fewer than three). */
export function defaultRange(availableMonths: string[]): { from: string; to: string } | undefined {
  if (availableMonths.length === 0) return undefined;
  const to = availableMonths[availableMonths.length - 1]!;
  const from = availableMonths[Math.max(0, availableMonths.length - 3)]!;
  return { from, to };
}

/** The available months (ascending) that fall within [from, to], inclusive. Months outside the list are not requested. */
export function monthsInRange(availableMonths: string[], from: string, to: string): string[] {
  return availableMonths.filter((month) => month >= from && month <= to);
}

function formatMonth(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}`;
}

/**
 * The months auto-sync fetches for `now` (UTC): always the current month,
 * plus the previous month on the 1st-3rd so late games are not missed.
 * Order: previous month first.
 */
export function autoSyncMonths(now: Date): string[] {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const current = formatMonth(year, month);
  if (now.getUTCDate() > 3) return [current];

  const previous = new Date(Date.UTC(year, month - 1, 1));
  return [formatMonth(previous.getUTCFullYear(), previous.getUTCMonth()), current];
}
