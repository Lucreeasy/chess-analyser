/** The date and time a game was played (`playedAt`). */

interface UtcDate {
  year: number;
  month: number;
  day: number;
}

function parseUtcDate(text: string): UtcDate | undefined {
  const match = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/.exec(text.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isReal = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isReal ? { year, month, day } : undefined;
}

function parseUtcTime(text: string): { hours: number; minutes: number; seconds: number } {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(text.trim());
  if (!match) return { hours: 0, minutes: 0, seconds: 0 };
  return { hours: Number(match[1]), minutes: Number(match[2]), seconds: match[3] ? Number(match[3]) : 0 };
}

/** The epoch-ms instant a game was played, or `importMoment` if no tag gives a usable date. */
export function resolvePlayedAt(tags: Map<string, string>, importMoment: number): number {
  const utcDate = parseUtcDate(tags.get("UTCDate") ?? "");
  if (utcDate) {
    const time = parseUtcTime(tags.get("UTCTime") ?? "");
    return Date.UTC(utcDate.year, utcDate.month - 1, utcDate.day, time.hours, time.minutes, time.seconds);
  }
  const date = parseUtcDate(tags.get("Date") ?? "");
  if (date) {
    const time = parseUtcTime(tags.get("Time") ?? "");
    return Date.UTC(date.year, date.month - 1, date.day, time.hours, time.minutes, time.seconds);
  }
  return importMoment;
}
