import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer, waitFor } from "./testServer.ts";

process.env.NODE_ENV = "test";
process.env.ENGINE_PATH = `node ${new URL("../fixtures/fake-engine.ts", import.meta.url).pathname}`;
const { server } = await import("../../src/server/index.ts");
const { shutdownEngine } = await import("../../src/server/engineClient.ts");

test("the analysis queue HTTP routes", async (t) => {
  try {
    await withServer(server, async (base) => {
      const pgn = '[White "a"]\n[Black "b"]\n[Result "1-0"]\n\n1. e4 e5 1-0';

      await t.test("GET /api/analyse/status before anything is queued", async () => {
        const res = await fetch(`${base}/api/analyse/status`);
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { paused: false, pending: 0, done: 0, total: 0, running: null });
      });

      await t.test("POST /api/analyse/queue: an invalid request is a 400 with the exact message", async () => {
        const res = await fetch(`${base}/api/analyse/queue`, { method: "POST", body: JSON.stringify({ gameIds: [] }) });
        assert.equal(res.status, 400);
        assert.deepEqual(await res.json(), { error: '"gameIds" must be a non-empty array of up to 10000 game ids' });
      });

      await t.test("POST /api/analyse/queue: an unknown id is a 400 with the exact message", async () => {
        const res = await fetch(`${base}/api/analyse/queue`, { method: "POST", body: JSON.stringify({ gameIds: ["ghost"] }) });
        assert.equal(res.status, 400);
        assert.deepEqual(await res.json(), { error: "unknown game ids (1): ghost" });
      });

      await t.test("POST /api/analyse/queue: a known game is queued and run to completion", async () => {
        const importRes = await fetch(`${base}/api/games/import`, { method: "POST", body: pgn });
        const { gameIds } = (await importRes.json()) as { gameIds: string[] };

        const queueRes = await fetch(`${base}/api/analyse/queue`, { method: "POST", body: JSON.stringify({ gameIds }) });
        assert.equal(queueRes.status, 200);
        const status = (await queueRes.json()) as { total: number };
        assert.equal(status.total, 1);

        await waitFor(async () => {
          const s = (await (await fetch(`${base}/api/analyse/status`)).json()) as { done: number; pending: number; running: unknown };
          return s.done === 1 && s.pending === 0 && s.running === null;
        });
      });

      await t.test("POST /api/analyse/pause and /resume toggle the paused status", async () => {
        const pauseRes = await fetch(`${base}/api/analyse/pause`, { method: "POST" });
        assert.equal((await pauseRes.json()).paused, true);

        const resumeRes = await fetch(`${base}/api/analyse/resume`, { method: "POST" });
        assert.equal((await resumeRes.json()).paused, false);
      });
    });
  } finally {
    await shutdownEngine();
  }
});
