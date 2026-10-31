/** Selecting which available months to fetch. docs/03-IMPORT-SPEC.md sections 3.1, 3.8. */

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
