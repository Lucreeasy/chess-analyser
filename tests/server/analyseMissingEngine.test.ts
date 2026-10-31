import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer } from "./testServer.ts";

process.env.NODE_ENV = "test";
process.env.ENGINE_PATH = "/no/such/engine-binary";
const { server } = await import("../../src/server/index.ts");

// docs/01-REQUIREMENTS.md ANA-6/ANA-7: without the engine, games stay un-analysed with a clear
// message and nothing else breaks.
test("a missing engine answers with a clear message, and the rest of the app still works", async () => {
  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/analyse`, {
      method: "POST",
      body: JSON.stringify({ pgn: '[White "a"]\n[Black "b"]\n[Result "1-0"]\n\n1. e4 e5 1-0' }),
    });
    assert.equal(res.status, 503);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /engine unavailable/);

    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    const list = await fetch(`${base}/api/games`);
    assert.equal(list.status, 200);
  });
});
