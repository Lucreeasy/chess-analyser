/** Pure validation and parsing helpers for the chess.com client. docs/03-IMPORT-SPEC.md section 3.3-3.4. */

export function isValidUsername(username: string): boolean {
  return /^[A-Za-z0-9_-]{3,25}$/.test(username.trim());
}

export function isValidMonth(month: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return false;
  const m = Number(match[2]);
  return m >= 1 && m <= 12;
}

/** The Retry-After header, in seconds: a plain number, or an HTTP date relative to `now`. */
export function parseRetryAfter(headerValue: string | null, now: number = Date.now()): number | undefined {
  if (!headerValue) return undefined;
  if (/^\d+$/.test(headerValue.trim())) return Number(headerValue.trim());
  const when = Date.parse(headerValue);
  if (Number.isNaN(when)) return undefined;
  return Math.max(0, Math.round((when - now) / 1000));
}

/** section 3.4: a 200 body is PGN-shaped if it carries at least one of these tags. */
export function looksLikePgn(body: string): boolean {
  return body.includes('[Event "') || body.includes('[White "') || body.includes('[Black "');
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Extracts, dedupes and sorts the YYYY-MM months from a chess.com archive-list answer. */
export function parseArchiveList(body: string): string[] | undefined {
  let json: unknown;
  try {
    json = JSON.parse(stripBom(body));
  } catch {
    return undefined;
  }
  const archives = (json as { archives?: unknown }).archives;
  if (!Array.isArray(archives)) return undefined;

  const months = new Set<string>();
  for (const url of archives) {
    if (typeof url !== "string") continue;
    const match = /\/games\/(\d{4})\/(\d{2})$/.exec(url);
    if (match) months.add(`${match[1]}-${match[2]}`);
  }
  return [...months].sort();
}
