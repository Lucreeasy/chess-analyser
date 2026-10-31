import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer } from "./testServer.ts";

process.env.NODE_ENV = "test";
process.env.ENGINE_PATH = `node ${new URL("../fixtures/fake-engine.ts", import.meta.url).pathname}`;
const { server } = await import("../../src/server/index.ts");
const { shutdownEngine } = await import("../../src/server/engineClient.ts");

test("POST /api/analyse runs a game through the engine and returns the analysis", async () => {
  try {
    await withServer(server, async (base) => {
      const res = await fetch(`${base}/api/analyse`, {
        method: "POST",
        body: JSON.stringify({ pgn: '[White "a"]\n[Black "b"]\n[Result "1-0"]\n\n1. e4 e5 1-0' }),
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as { moves: Array<{ classification: string }> };
      assert.equal(body.moves.length, 2);
      assert.equal(body.moves[0].classification, "book"); // 1.e4 is in the opening book
    });
  } finally {
    await shutdownEngine(); // otherwise the fake engine's process keeps this test file alive
  }
});
