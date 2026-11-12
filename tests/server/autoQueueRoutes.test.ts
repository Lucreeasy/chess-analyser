import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer, waitFor } from "./testServer.ts";

process.env.NODE_ENV = "test";
process.env.ENGINE_PATH = `node ${new URL("../fixtures/fake-engine.ts", import.meta.url).pathname}`;
const { server, chessComDeps } = await import("../../src/server/index.ts");
const { shutdownEngine } = await import("../../src/server/engineClient.ts");

interface FakeResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

function fakeFetch(byUrlFragment: Record<string, FakeResponse>) {
  return async (url: string) => {
    for (const [fragment, res] of Object.entries(byUrlFragment)) {
      if (url.includes(fragment)) {
        return { status: res.status, headers: { get: (name: string) => res.headers[name.toLowerCase()] ?? null }, text: async () => res.body };
      }
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}

// Every import that stores new games queues exactly those, by default.
test("auto-queueing on import", async (t) => {
  try {
    await withServer(server, async (base) => {
      await t.test("pasting a PGN auto-queues the new game, which the worker then analyses", async () => {
        const pgn = '[White "a"]\n[Black "b"]\n[Result "1-0"]\n\n1. e4 e5 1-0';
        const importRes = await fetch(`${base}/api/games/import`, { method: "POST", body: pgn });
        const report = (await importRes.json()) as { queued: number };
        assert.equal(report.queued, 1);

        await waitFor(async () => {
          const status = (await (await fetch(`${base}/api/analyse/status`)).json()) as { done: number };
          return status.done === 1;
        });
      });

      await t.test("turning autoAnalyse off: an import queues nothing", async () => {
        await fetch(`${base}/api/settings`, { method: "POST", body: JSON.stringify({ autoAnalyse: false }) });
        const pgn = '[White "x"]\n[Black "y"]\n[Result "1-0"]\n\n1. e4 e5 1-0';
        const importRes = await fetch(`${base}/api/games/import`, { method: "POST", body: pgn });
        const report = (await importRes.json()) as { queued: number };
        assert.equal(report.queued, 0);
      });

      await t.test("a chess.com import auto-queues the new games", async () => {
        await fetch(`${base}/api/settings`, { method: "POST", body: JSON.stringify({ autoAnalyse: true }) }); // undo the previous sub-test
        const pgn = '[Event "Live Chess"]\n[White "alice"]\n[Black "bc_tester"]\n[TimeControl "180+2"]\n\n1. e4 e5 1-0';
        chessComDeps.fetch = fakeFetch({
          "/games/archives": { status: 200, headers: {}, body: JSON.stringify({ archives: ["https://api.chess.com/pub/player/bc_tester/games/2026/09"] }) },
          "/games/2026/09/pgn": { status: 200, headers: {}, body: pgn },
        }) as typeof chessComDeps.fetch;

        const res = await fetch(`${base}/api/chesscom/import`, {
          method: "POST",
          body: JSON.stringify({ username: "bc_tester", from: "2026-09", to: "2026-09", timeClasses: ["blitz"] }),
        });
        const body = (await res.json()) as { queued: number };
        assert.equal(body.queued, 1);
      });
    });
  } finally {
    await shutdownEngine();
  }
});
