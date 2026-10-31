import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer } from "./testServer.ts";

process.env.NODE_ENV = "test";
process.env.AUTO_SYNC_INTERVAL_HOURS = "6";
const { server, chessComDeps } = await import("../../src/server/index.ts");

interface FakeResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

function fakeFetch(byUrlFragment: Record<string, FakeResponse>) {
  return async (url: string) => {
    for (const [fragment, res] of Object.entries(byUrlFragment)) {
      if (url.includes(fragment)) {
        return {
          status: res.status,
          headers: { get: (name: string) => res.headers[name.toLowerCase()] ?? null },
          text: async () => res.body,
        };
      }
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}

test("GET /api/autosync/status answers the status before any run", async () => {
  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/autosync/status`);
    assert.equal(res.status, 200);
    const status = (await res.json()) as { enabled: boolean; intervalHours: number; running: boolean; lastResults: unknown[] };
    assert.equal(status.intervalHours, 6);
    assert.equal(status.running, false);
    assert.deepEqual(status.lastResults, []);
  });
});

test("POST /api/autosync/sync-now: refused with no saved usernames", async () => {
  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/autosync/sync-now`, { method: "POST" });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "set a chess.com username in Settings first" });
  });
});

test("POST /api/autosync/sync-now: fetches a saved username's recent months and stores new games", async () => {
  await withServer(server, async (base) => {
    await fetch(`${base}/api/settings`, { method: "POST", body: JSON.stringify({ usernames: ["bc_tester"] }) });

    const pgn = '[Event "Live Chess"]\n[White "alice"]\n[Black "bc_tester"]\n[TimeControl "180+2"]\n\n1. e4 e5 1-0';
    chessComDeps.fetch = fakeFetch({ "/games/": { status: 200, headers: {}, body: pgn } }) as typeof chessComDeps.fetch;

    const res = await fetch(`${base}/api/autosync/sync-now`, { method: "POST" });
    assert.equal(res.status, 200);

    await new Promise((resolve) => setTimeout(resolve, 50)); // the run happens in the background
    const status = (await (await fetch(`${base}/api/autosync/status`)).json()) as {
      running: boolean;
      lastResults: Array<{ username: string; added: number }>;
    };
    assert.equal(status.running, false);
    assert.equal(status.lastResults[0]!.username, "bc_tester");
    assert.equal(status.lastResults[0]!.added, 1);

    const games = (await (await fetch(`${base}/api/games`)).json()) as Array<{ white: string }>;
    assert.equal(games.length, 1);
    assert.equal(games[0]!.white, "alice");
  });
});
