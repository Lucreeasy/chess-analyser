import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchMonth,
  fetchArchiveMonths,
  monthPgnUrl,
  type HttpResponseLike,
  type FetchMonthOptions,
} from "../../../src/server/chesscom/client.ts";
import { RequestPacer } from "../../../src/server/chesscom/pacer.ts";

function response(status: number, body = "", headers: Record<string, string> = {}): HttpResponseLike {
  return {
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => body,
  };
}

function fastPacer(): RequestPacer {
  return new RequestPacer(0, Date.now, async () => {}); // no real waiting, for fast tests
}

// No real waiting anywhere (retry backoff or the per-request abort timer), so these tests run instantly
// while still exercising the real retry counts and the spec's exact wording.
function fastOptions(overrides: FetchMonthOptions = {}): FetchMonthOptions {
  return { timeoutMs: 5, wait: async () => {}, ...overrides };
}

test("monthPgnUrl: lower-cases the username", () => {
  assert.equal(monthPgnUrl("BC_Tester", "2026-09"), "https://api.chess.com/pub/player/bc_tester/games/2026/09/pgn");
});

test("200 with games: pgn and etag are returned", async () => {
  const pgn = '[Event "Live Chess"]\n[White "a"]\n[Black "b"]\n\n1. e4 1-0';
  const fetchImpl = async () => response(200, pgn, { etag: '"abc"' });
  const result = await fetchMonth(fetchImpl, fastPacer(), "bc_tester", "2026-09", fastOptions());
  assert.equal(result.status, "ok");
  assert.equal(result.pgn, pgn);
  assert.equal(result.etag, '"abc"');
});

test("200 with an empty body: 'no games', not an error", async () => {
  const fetchImpl = async () => response(200, "   ");
  const result = await fetchMonth(fetchImpl, fastPacer(), "bc_tester", "2026-09", fastOptions());
  assert.equal(result.status, "ok");
  assert.equal(result.message, "no games");
  assert.equal(result.pgn, undefined);
});

test("200 with non-PGN content (e.g. a block page): an error, not retried", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return response(200, "<html>blocked</html>");
  };
  const result = await fetchMonth(fetchImpl, fastPacer(), "bc_tester", "2026-09", fastOptions());
  assert.equal(result.status, "error");
  assert.equal(result.message, "unexpected response from chess.com (not PGN)");
  assert.equal(calls, 1);
});

test("a leading BOM is stripped before checking for games/PGN markers", async () => {
  const pgn = '﻿[White "a"]\n1. e4 1-0';
  const fetchImpl = async () => response(200, pgn);
  const result = await fetchMonth(fetchImpl, fastPacer(), "bc_tester", "2026-09", fastOptions());
  assert.equal(result.status, "ok");
  assert.equal(result.pgn, '[White "a"]\n1. e4 1-0');
});

test("304 with an ETag sent: unchanged, no parsing", async () => {
  const fetchImpl = async () => response(304);
  const result = await fetchMonth(fetchImpl, fastPacer(), "bc_tester", "2026-09", fastOptions({ ifNoneMatch: '"abc"' }));
  assert.equal(result.status, "ok");
  assert.equal(result.unchanged, true);
  assert.equal(result.message, "unchanged since the last sync");
});

test("404: not_found with the exact message, no retries", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return response(404);
  };
  const result = await fetchMonth(fetchImpl, fastPacer(), "bc_tester", "2026-09", fastOptions());
  assert.equal(result.status, "not_found");
  assert.equal(result.message, "no games for bc_tester in 2026-09");
  assert.equal(calls, 1);
});

test("5xx: retried, then reports the exact server-error message", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return response(500);
  };
  const result = await fetchMonth(fetchImpl, fastPacer(), "bc_tester", "2026-09", fastOptions());
  assert.equal(result.status, "error");
  assert.equal(result.message, "chess.com server error (HTTP 500)");
  assert.equal(calls, 4); // first attempt + 3 retries
});

test("an unexpected status (e.g. 403): not retried", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return response(403);
  };
  const result = await fetchMonth(fetchImpl, fastPacer(), "bc_tester", "2026-09", fastOptions());
  assert.equal(result.status, "error");
  assert.equal(result.message, "chess.com answered HTTP 403");
  assert.equal(calls, 1);
});

test("a network error: retried, then reports the system message", async () => {
  const fetchImpl = async () => {
    throw new Error("ECONNRESET");
  };
  const result = await fetchMonth(fetchImpl, fastPacer(), "bc_tester", "2026-09", fastOptions());
  assert.equal(result.status, "error");
  assert.equal(result.message, "network error: ECONNRESET");
});

test("429 without a hint: retried, then rate_limited with the exact message", async () => {
  const fetchImpl = async () => response(429);
  const result = await fetchMonth(fetchImpl, fastPacer(), "bc_tester", "2026-09", fastOptions());
  assert.equal(result.status, "rate_limited");
  assert.equal(result.message, "chess.com is rate limiting requests; retry in about 16 s");
  assert.equal(result.retryAfterSeconds, 16);
});

test("429 with Retry-After: 7 succeeds after waiting", async () => {
  let calls = 0;
  const waits: number[] = [];
  const fetchImpl = async () => {
    calls++;
    return calls === 1 ? response(429, "", { "retry-after": "7" }) : response(200, '[White "a"]\n1. e4 1-0');
  };
  const result = await fetchMonth(
    fetchImpl,
    fastPacer(),
    "bc_tester",
    "2026-09",
    fastOptions({ wait: async (ms) => void waits.push(ms) }),
  );
  assert.equal(result.status, "ok");
  assert.equal(calls, 2);
  assert.deepEqual(waits, [7000]);
});

test("a request that never answers is reported as a timeout", async () => {
  const fetchImpl = (_url: string, init: { signal: AbortSignal }) =>
    new Promise<HttpResponseLike>((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });
  const result = await fetchMonth(fetchImpl, fastPacer(), "bc_tester", "2026-09", fastOptions());
  assert.equal(result.status, "error");
  assert.equal(result.message, "chess.com did not answer within 30 s");
});

// fetchArchiveMonths: section 3.3-3.4.
test("fetchArchiveMonths: 200 with an archive list returns sorted, deduped months", async () => {
  const fetchImpl = async () =>
    response(200, JSON.stringify({ archives: ["https://api.chess.com/pub/player/bc_tester/games/2026/03"] }));
  const result = await fetchArchiveMonths(fetchImpl, fastPacer(), "bc_tester", fastOptions());
  assert.equal(result.status, "ok");
  assert.deepEqual(result.months, ["2026-03"]);
});

test("fetchArchiveMonths: a player with no games gives an empty list, not an error", async () => {
  const fetchImpl = async () => response(200, JSON.stringify({ archives: [] }));
  const result = await fetchArchiveMonths(fetchImpl, fastPacer(), "bc_tester", fastOptions());
  assert.equal(result.status, "ok");
  assert.deepEqual(result.months, []);
});

test("fetchArchiveMonths: invalid JSON is the exact 'no archive list' error", async () => {
  const fetchImpl = async () => response(200, "not json");
  const result = await fetchArchiveMonths(fetchImpl, fastPacer(), "bc_tester", fastOptions());
  assert.equal(result.status, "error");
  assert.equal(result.message, "unexpected response from chess.com (no archive list)");
});

test("fetchArchiveMonths: 404 is the exact 'user not found' message", async () => {
  const fetchImpl = async () => response(404);
  const result = await fetchArchiveMonths(fetchImpl, fastPacer(), "bc_tester", fastOptions());
  assert.equal(result.status, "not_found");
  assert.equal(result.message, 'chess.com user "bc_tester" not found');
});

test("fetchArchiveMonths: 429 reuses the same rate-limit wording as fetchMonth", async () => {
  const fetchImpl = async () => response(429);
  const result = await fetchArchiveMonths(fetchImpl, fastPacer(), "bc_tester", fastOptions());
  assert.equal(result.status, "rate_limited");
  assert.equal(result.message, "chess.com is rate limiting requests; retry in about 16 s");
  assert.equal(result.retryAfterSeconds, 16);
});
