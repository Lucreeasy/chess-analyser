import { withRetry, type AttemptOutcome } from "./httpRetry.ts";
import type { RequestPacer } from "./pacer.ts";
import { parseRetryAfter, stripBom, looksLikePgn, parseArchiveList } from "./parsing.ts";

/** The chess.com HTTP client. docs/03-IMPORT-SPEC.md sections 3.3-3.4, 3.6. */

export const USER_AGENT = "ChessAnalyser/1 (self-hosted; personal use)";
const API = "https://api.chess.com";
/** Section 3.3: 30s per request. Overridable so tests don't wait 30 real seconds to see a timeout. */
export const TIMEOUT_MS = 30000;

export interface HttpResponseLike {
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}
export type FetchLike = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<HttpResponseLike>;

export function monthPgnUrl(username: string, month: string): string {
  const [year, monthNum] = month.split("-");
  return `${API}/pub/player/${username.trim().toLowerCase()}/games/${year}/${monthNum}/pgn`;
}

export function archiveListUrl(username: string): string {
  return `${API}/pub/player/${username.trim().toLowerCase()}/games/archives`;
}

interface RawOutcome extends AttemptOutcome {
  body?: string;
  etag?: string;
  is304?: boolean;
  status?: number;
  errorMessage?: string;
}

/**
 * The wording shared by both endpoints for the failure kinds that don't
 * need endpoint-specific text (ok and not_found are handled by the
 * caller). Undefined for kinds the caller must handle itself.
 */
function genericFailureMessage(
  outcome: RawOutcome,
): { status: "rate_limited" | "error"; message: string; retryAfterSeconds?: number } | undefined {
  switch (outcome.kind) {
    case "rate_limited": {
      const retryAfterSeconds = outcome.retryAfterSeconds ?? 16;
      return {
        status: "rate_limited",
        message: `chess.com is rate limiting requests; retry in about ${retryAfterSeconds} s`,
        retryAfterSeconds,
      };
    }
    case "server_error":
      return { status: "error", message: `chess.com server error (HTTP ${outcome.status})` };
    case "other_status":
      return { status: "error", message: `chess.com answered HTTP ${outcome.status}` };
    case "network_error":
      return { status: "error", message: `network error: ${outcome.errorMessage}` };
    case "timeout":
      return { status: "error", message: "chess.com did not answer within 30 s" };
    default:
      return undefined;
  }
}

/**
 * Runs one paced, timed-out, retry-outcome-mapped HTTP request. Both endpoints share the
 * timeout scaffolding and the status-code ladder (404/410/429/5xx/other); only the request
 * headers and the handling of a 200 differ, so those are passed in by the caller.
 */
async function attemptFetch(
  fetchImpl: FetchLike,
  pacer: RequestPacer,
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  onOk: (res: HttpResponseLike) => Promise<RawOutcome>,
): Promise<RawOutcome> {
  return pacer.run(async (): Promise<RawOutcome> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { headers, signal: controller.signal });

      if (res.status === 304) return { kind: "ok", is304: true };
      if (res.status === 404 || res.status === 410) return { kind: "not_found" };
      if (res.status === 429) return { kind: "rate_limited", retryAfterSeconds: parseRetryAfter(res.headers.get("retry-after")) };
      if (res.status >= 500) return { kind: "server_error", status: res.status };
      if (res.status !== 200) return { kind: "other_status", status: res.status };
      return await onOk(res);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return { kind: "timeout" };
      return { kind: "network_error", errorMessage: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(timer);
    }
  });
}

async function attemptMonthFetch(
  fetchImpl: FetchLike,
  pacer: RequestPacer,
  username: string,
  month: string,
  ifNoneMatch: string | undefined,
  timeoutMs: number,
): Promise<RawOutcome> {
  const headers: Record<string, string> = { Accept: "application/x-chess-pgn, text/plain", "User-Agent": USER_AGENT };
  if (ifNoneMatch) headers["If-None-Match"] = ifNoneMatch;
  return attemptFetch(fetchImpl, pacer, monthPgnUrl(username, month), headers, timeoutMs, async (res) => ({
    kind: "ok",
    body: await res.text(),
    etag: res.headers.get("etag") ?? undefined,
  }));
}

export interface MonthFetchResult {
  status: "ok" | "not_found" | "rate_limited" | "error";
  message: string;
  /** Present when status is "ok" and the month had games. */
  pgn?: string;
  /** Present only on a full 200 fetch that returned an ETag. */
  etag?: string;
  unchanged?: boolean;
  /** Present when status is "rate_limited". */
  retryAfterSeconds?: number;
}

export interface FetchMonthOptions {
  ifNoneMatch?: string;
  /** Overridable so tests see the real wording without waiting the real durations. */
  timeoutMs?: number;
  wait?: (ms: number) => Promise<void>;
}

const realWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Fetches one month of a player's games. Section 3.4 (answer handling), 3.6 (ETags). */
export async function fetchMonth(
  fetchImpl: FetchLike,
  pacer: RequestPacer,
  username: string,
  month: string,
  options: FetchMonthOptions = {},
): Promise<MonthFetchResult> {
  const { ifNoneMatch, timeoutMs = TIMEOUT_MS, wait = realWait } = options;
  const { outcome } = await withRetry(
    () => attemptMonthFetch(fetchImpl, pacer, username, month, ifNoneMatch, timeoutMs),
    3,
    wait,
  );

  if (outcome.kind === "ok") {
    if (outcome.is304) return { status: "ok", message: "unchanged since the last sync", unchanged: true };
    const body = stripBom(outcome.body ?? "");
    if (body.trim() === "") return { status: "ok", message: "no games" };
    if (!looksLikePgn(body)) return { status: "error", message: "unexpected response from chess.com (not PGN)" };
    return { status: "ok", message: "", pgn: body, etag: outcome.etag };
  }
  if (outcome.kind === "not_found") return { status: "not_found", message: `no games for ${username} in ${month}` };
  return genericFailureMessage(outcome)!;
}

async function attemptArchiveFetch(fetchImpl: FetchLike, pacer: RequestPacer, username: string, timeoutMs: number): Promise<RawOutcome> {
  const headers: Record<string, string> = { Accept: "application/json", "User-Agent": USER_AGENT };
  return attemptFetch(fetchImpl, pacer, archiveListUrl(username), headers, timeoutMs, async (res) => ({
    kind: "ok",
    body: await res.text(),
  }));
}

export interface ArchiveListResult {
  status: "ok" | "not_found" | "rate_limited" | "error";
  message?: string;
  months?: string[];
  /** Present when status is "rate_limited". */
  retryAfterSeconds?: number;
}

/** The months a player has archived games in, ascending. Section 3.3. */
export async function fetchArchiveMonths(
  fetchImpl: FetchLike,
  pacer: RequestPacer,
  username: string,
  options: Omit<FetchMonthOptions, "ifNoneMatch"> = {},
): Promise<ArchiveListResult> {
  const { timeoutMs = TIMEOUT_MS, wait = realWait } = options;
  const { outcome } = await withRetry(() => attemptArchiveFetch(fetchImpl, pacer, username, timeoutMs), 3, wait);

  if (outcome.kind === "ok") {
    const months = parseArchiveList(outcome.body ?? "");
    if (months === undefined) return { status: "error", message: "unexpected response from chess.com (no archive list)" };
    return { status: "ok", months };
  }
  if (outcome.kind === "not_found") return { status: "not_found", message: `chess.com user "${username}" not found` };
  return genericFailureMessage(outcome)!;
}
