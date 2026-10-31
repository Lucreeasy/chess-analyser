import { test } from "node:test";
import assert from "node:assert/strict";
import { syncMonths } from "../../../src/server/chesscom/sync.ts";
import { RequestPacer } from "../../../src/server/chesscom/pacer.ts";
import type { HttpResponseLike } from "../../../src/server/chesscom/client.ts";
import type { StoredGame } from "../../../src/server/import/parseGame.ts";
import type { TimeClass } from "../../../src/server/import/timeClass.ts";

const NOW = Date.UTC(2026, 9, 31);
const ALL_CLASSES = new Set<TimeClass>(["bullet", "blitz", "rapid", "daily", "classical"]);

function response(status: number, body = "", headers: Record<string, string> = {}): HttpResponseLike {
  return {
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => body,
  };
}

function fastPacer(): RequestPacer {
  return new RequestPacer(0, Date.now, async () => {});
}

function onePgn(white: string, black: string): string {
  return `[Event "Live Chess"]\n[White "${white}"]\n[Black "${black}"]\n[TimeControl "180+2"]\n\n1. e4 e5 1-0`;
}

function monthFetchImpl(byMonth: Record<string, HttpResponseLike>) {
  return async (url: string): Promise<HttpResponseLike> => {
    for (const [month, res] of Object.entries(byMonth)) {
      const [year, monthNum] = month.split("-");
      if (url.includes(`/games/${year}/${monthNum}/pgn`)) return res;
    }
    throw new Error(`unexpected month request: ${url}`);
  };
}

function collector(): { store: (g: StoredGame[]) => void; stored: StoredGame[] } {
  const stored: StoredGame[] = [];
  return { store: (g) => stored.push(...g), stored };
}

test("an ok month is parsed and stored, reported with the exact counts", async () => {
  const fetchImpl = monthFetchImpl({ "2026-09": response(200, onePgn("a", "b")) });
  const { store, stored } = collector();
  const result = await syncMonths(fetchImpl, fastPacer(), "bc_tester", ["2026-09"], ALL_CLASSES, new Set(), store, NOW, {
    timeoutMs: 5,
    wait: async () => {},
  });
  assert.deepEqual(result.months, [{ month: "2026-09", status: "ok", message: "1 new, 0 duplicates, 0 failed" }]);
  assert.equal(result.added, 1);
  assert.equal(stored.length, 1);
});

test("an empty-games month reports 'no games' and stores nothing", async () => {
  const fetchImpl = monthFetchImpl({ "2026-09": response(200, "   ") });
  const { store, stored } = collector();
  const result = await syncMonths(fetchImpl, fastPacer(), "bc_tester", ["2026-09"], ALL_CLASSES, new Set(), store, NOW, {
    timeoutMs: 5,
    wait: async () => {},
  });
  assert.deepEqual(result.months, [{ month: "2026-09", status: "ok", message: "no games" }]);
  assert.equal(stored.length, 0);
});

test("a 404 month does not stop the import", async () => {
  const fetchImpl = monthFetchImpl({
    "2026-08": response(404),
    "2026-09": response(200, onePgn("a", "b")),
  });
  const { store } = collector();
  const result = await syncMonths(fetchImpl, fastPacer(), "bc_tester", ["2026-08", "2026-09"], ALL_CLASSES, new Set(), store, NOW, {
    timeoutMs: 5,
    wait: async () => {},
  });
  assert.equal(result.months[0]!.status, "not_found");
  assert.equal(result.months[1]!.status, "ok");
  assert.equal(result.added, 1);
});

test("a rate-limited month stops the import: every later month is rate_limited, not fetched", async () => {
  const fetchImpl = monthFetchImpl({ "2026-07": response(429) });
  const { store } = collector();
  const result = await syncMonths(
    fetchImpl,
    fastPacer(),
    "bc_tester",
    ["2026-07", "2026-08", "2026-09"],
    ALL_CLASSES,
    new Set(),
    store,
    NOW,
    { timeoutMs: 5, wait: async () => {} },
  );
  assert.equal(result.months[0]!.status, "rate_limited");
  assert.equal(result.months[0]!.message, "chess.com is rate limiting requests; retry in about 16 s");
  assert.equal(result.months[1]!.status, "rate_limited");
  assert.equal(result.months[1]!.message, "not fetched: stopped after chess.com rate limiting (retry in about 16 s)");
  assert.equal(result.months[2]!.status, "rate_limited");
  assert.equal(result.months[2]!.message, "not fetched: stopped after chess.com rate limiting (retry in about 16 s)");
});

test("an empty month range gives an empty report, no requests", async () => {
  const fetchImpl = async (): Promise<HttpResponseLike> => {
    throw new Error("should not be called");
  };
  const { store } = collector();
  const result = await syncMonths(fetchImpl, fastPacer(), "bc_tester", [], ALL_CLASSES, new Set(), store, NOW);
  assert.deepEqual(result, { months: [], added: 0, duplicates: 0, failed: 0 });
});

test("progress events: before each month, and a final one at done = total", async () => {
  const fetchImpl = monthFetchImpl({
    "2026-08": response(200, "   "),
    "2026-09": response(200, "   "),
  });
  const events: Array<{ username: string; month: string; done: number; total: number }> = [];
  const { store } = collector();
  await syncMonths(fetchImpl, fastPacer(), "bc_tester", ["2026-08", "2026-09"], ALL_CLASSES, new Set(), store, NOW, {
    timeoutMs: 5,
    wait: async () => {},
    onProgress: (e) => events.push(e),
  });
  assert.deepEqual(events, [
    { username: "bc_tester", month: "2026-08", done: 0, total: 2 },
    { username: "bc_tester", month: "2026-09", done: 1, total: 2 },
    { username: "bc_tester", month: "2026-09", done: 2, total: 2 },
  ]);
});

test("the time-class filter is applied to each month's games", async () => {
  const bullet = `[Event "Live Chess"]\n[White "a"]\n[Black "b"]\n[TimeControl "60"]\n\n1. e4 e5 1-0`;
  const fetchImpl = monthFetchImpl({ "2026-09": response(200, bullet) });
  const { store, stored } = collector();
  const result = await syncMonths(
    fetchImpl,
    fastPacer(),
    "bc_tester",
    ["2026-09"],
    new Set<TimeClass>(["blitz"]),
    new Set(),
    store,
    NOW,
    { timeoutMs: 5, wait: async () => {} },
  );
  assert.equal(result.added, 0);
  assert.equal(stored.length, 0);
  assert.equal(result.months[0]!.message, "0 new, 0 duplicates, 0 failed");
});

test("already-stored ids carry across months within the same run", async () => {
  const pgn = onePgn("a", "b");
  const fetchImpl = monthFetchImpl({ "2026-08": response(200, pgn), "2026-09": response(200, pgn) });
  const { store, stored } = collector();
  const result = await syncMonths(fetchImpl, fastPacer(), "bc_tester", ["2026-08", "2026-09"], ALL_CLASSES, new Set(), store, NOW, {
    timeoutMs: 5,
    wait: async () => {},
  });
  assert.equal(result.added, 1);
  assert.equal(result.duplicates, 1);
  assert.equal(stored.length, 1);
});
