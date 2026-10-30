import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
const { server } = await import("../../src/server/index.ts");

async function withServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("expected a port");
  }
  try {
    return await run(`http://localhost:${address.port}`);
  } finally {
    server.close();
  }
}

test("GET /health answers ok", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  });
});

test("importing a PGN makes it appear in the games list", async () => {
  await withServer(async (base) => {
    const pgn = '[White "alice"]\n[Black "bob"]\n[Result "1-0"]\n\n1. e4 e5 1-0';
    const importRes = await fetch(`${base}/api/games/import`, { method: "POST", body: pgn });
    assert.equal(importRes.status, 200);

    const listRes = await fetch(`${base}/api/games`);
    const games = (await listRes.json()) as Array<{ white: string; black: string }>;
    assert.equal(games.length, 1);
    assert.equal(games[0].white, "alice");
    assert.equal(games[0].black, "bob");
  });
});
