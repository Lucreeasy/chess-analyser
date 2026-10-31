import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer } from "./testServer.ts";

process.env.NODE_ENV = "test";
const { server } = await import("../../src/server/index.ts");

test("GET /health answers ok", async () => {
  await withServer(server, async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  });
});

test("importing a PGN makes it appear in the games list; re-importing adds nothing", async () => {
  await withServer(server, async (base) => {
    const pgn = '[White "alice"]\n[Black "bob"]\n[Result "1-0"]\n\n1. e4 e5 1-0';
    const importRes = await fetch(`${base}/api/games/import`, { method: "POST", body: pgn });
    assert.equal(importRes.status, 200);
    const report = (await importRes.json()) as { total: number; added: number; duplicates: number };
    assert.equal(report.total, 1);
    assert.equal(report.added, 1);
    assert.equal(report.duplicates, 0);

    const listRes = await fetch(`${base}/api/games`);
    const games = (await listRes.json()) as Array<{ white: string; black: string }>;
    assert.equal(games.length, 1);
    assert.equal(games[0].white, "alice");
    assert.equal(games[0].black, "bob");

    const again = await fetch(`${base}/api/games/import`, { method: "POST", body: pgn });
    const againReport = (await again.json()) as { added: number; duplicates: number };
    assert.equal(againReport.added, 0);
    assert.equal(againReport.duplicates, 1);
  });
});
