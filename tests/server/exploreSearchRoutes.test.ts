import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer } from "./testServer.ts";

process.env.NODE_ENV = "test";
process.env.ENGINE_PATH = `node ${new URL("../fixtures/fake-engine.ts", import.meta.url).pathname}`;
const { server } = await import("../../src/server/index.ts");
const { getEngine, shutdownEngine } = await import("../../src/server/engineClient.ts");

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

test("the explore search HTTP routes", async (t) => {
  try {
    await withServer(server, async (base) => {
      await t.test("POST /api/explore/search: a missing field is a 400 with a message", async () => {
        const res = await fetch(`${base}/api/explore/search`, { method: "POST", body: JSON.stringify({ fen: START }) });
        assert.equal(res.status, 400);
        assert.deepEqual(await res.json(), { error: '"fen", "sideToMove" ("w"/"b"), "clientId" and "requestId" are required' });
      });

      await t.test("POST /api/explore/search: an illegal position is a 200 with ok: false, not a search", async () => {
        const res = await fetch(`${base}/api/explore/search`, {
          method: "POST",
          body: JSON.stringify({ fen: "not a fen", sideToMove: "w", clientId: "a", requestId: "r1" }),
        });
        assert.equal(res.status, 200);
        const body = (await res.json()) as { ok: boolean; error?: string };
        assert.equal(body.ok, false);
        assert.match(body.error!, /^invalid FEN:/);
      });

      await t.test("POST /api/explore/search: a legal position starts a search", async () => {
        const res = await fetch(`${base}/api/explore/search`, {
          method: "POST",
          body: JSON.stringify({ fen: START, sideToMove: "w", clientId: "a", requestId: "r1" }),
        });
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { ok: true });
        // The search itself runs fire-and-forget (the response doesn't wait for it); wait for the shared
        // engine to actually finish starting before this test's own shutdownEngine() runs, so it doesn't
        // race a still-starting engine process into being orphaned.
        await getEngine();
      });

      await t.test("POST /api/explore/stop: always answers ok: true", async () => {
        const res = await fetch(`${base}/api/explore/stop`, { method: "POST" });
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { ok: true });
      });
    });
  } finally {
    await shutdownEngine();
  }
});
