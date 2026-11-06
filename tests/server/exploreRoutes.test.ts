import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer } from "./testServer.ts";

process.env.NODE_ENV = "test";
const { server } = await import("../../src/server/index.ts");

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

test("GET /api/explore/dests: legal destinations from the given FEN", async () => {
  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/explore/dests?fen=${encodeURIComponent(START)}`);
    assert.equal(res.status, 200);
    const dests = (await res.json()) as Record<string, string[]>;
    assert.deepEqual(dests.e2, ["e3", "e4"]);
  });
});

test("GET /api/explore/dests: an illegal/malformed FEN answers an empty map, not an error", async () => {
  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/explore/dests?fen=not-a-fen`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {});
  });
});

test("POST /api/explore/move: an ordinary move", async () => {
  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/explore/move`, {
      method: "POST",
      body: JSON.stringify({ fen: START, uci: "e2e4" }),
    });
    assert.equal(res.status, 200);
    const result = (await res.json()) as { ok: boolean; san: string; fen: string };
    assert.equal(result.ok, true);
    assert.equal(result.san, "e4");
  });
});

test("POST /api/explore/move: a missing field is a 400 with a message", async () => {
  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/explore/move`, { method: "POST", body: JSON.stringify({ fen: START }) });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: '"fen" and "uci" must be strings' });
  });
});

test("POST /api/explore/move: an illegal move answers ok: false with a 200 (not a client error)", async () => {
  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/explore/move`, {
      method: "POST",
      body: JSON.stringify({ fen: START, uci: "a1a5" }),
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: false });
  });
});
