import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer } from "./testServer.ts";

process.env.NODE_ENV = "test";
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

test("GET /api/chesscom/archives: invalid username is a 400 with the exact message", async () => {
  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/chesscom/archives?username=a`);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'username must be 3-25 letters, digits, "_" or "-"' });
  });
});

test("GET /api/chesscom/archives: 200 with the months", async () => {
  chessComDeps.fetch = fakeFetch({
    "/games/archives": { status: 200, headers: {}, body: JSON.stringify({ archives: ["https://api.chess.com/pub/player/bc_tester/games/2026/09"] }) },
  }) as typeof chessComDeps.fetch;
  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/chesscom/archives?username=bc_tester`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { months: ["2026-09"] });
  });
});

test("GET /api/chesscom/archives: an unknown chess.com user is a 404", async () => {
  chessComDeps.fetch = fakeFetch({ "/games/archives": { status: 404, headers: {}, body: "" } }) as typeof chessComDeps.fetch;
  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/chesscom/archives?username=bc_tester`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'chess.com user "bc_tester" not found' });
  });
});

test("POST /api/chesscom/import: an invalid request body is a 400 with the exact message, no chess.com calls", async () => {
  chessComDeps.fetch = (async () => {
    throw new Error("should not be called");
  }) as typeof chessComDeps.fetch;
  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/chesscom/import`, { method: "POST", body: "not json" });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "JSON body required" });
  });
});

test("POST /api/chesscom/import: fetches months within range and stores new games", async () => {
  const pgn = '[Event "Live Chess"]\n[White "alice"]\n[Black "bc_tester"]\n[TimeControl "180+2"]\n\n1. e4 e5 1-0';
  chessComDeps.fetch = fakeFetch({
    "/games/archives": {
      status: 200,
      headers: {},
      body: JSON.stringify({
        archives: ["https://api.chess.com/pub/player/bc_tester/games/2026/08", "https://api.chess.com/pub/player/bc_tester/games/2026/09"],
      }),
    },
    "/games/2026/09/pgn": { status: 200, headers: {}, body: pgn },
    "/games/2026/08/pgn": { status: 200, headers: {}, body: "   " },
  }) as typeof chessComDeps.fetch;

  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/chesscom/import`, {
      method: "POST",
      body: JSON.stringify({ username: "bc_tester", from: "2026-08", to: "2026-09", timeClasses: ["blitz"] }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { added: number; months: Array<{ month: string; status: string }> };
    assert.equal(body.added, 1);
    assert.deepEqual(
      body.months.map((m) => m.month),
      ["2026-08", "2026-09"],
    );

    const games = (await (await fetch(`${base}/api/games`)).json()) as Array<{ white: string }>;
    assert.equal(games.length, 1);
    assert.equal(games[0].white, "alice");
  });
});
