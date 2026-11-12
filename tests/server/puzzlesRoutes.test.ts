import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer } from "./testServer.ts";
import { insertGames, finishAnalysis } from "../../src/server/db.ts";
import { cpFromWinPercent } from "../../src/server/analysis/winPercent.ts";
import { makeGame, makeAnalysis } from "./insights/fixtures.ts";

process.env.NODE_ENV = "test";
const { server, db } = await import("../../src/server/index.ts");

test("refresh builds the puzzles; the list has the opponent but never the solution; bad filters are rejected", async () => {
  insertGames(db, [makeGame({ id: "pz", white: "me", black: "rival", playedAt: Date.now() - 3_600_000 })]);
  const blunder = {
    san: "a3",
    uci: "a2a3",
    fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    classification: "blunder" as const,
    epLoss: 0.3,
    phase: "opening" as const,
    bestLine: { cp: cpFromWinPercent(60), pv: ["e2e4"] },
  };
  finishAnalysis(db, "pz", "standard", makeAnalysis({ moves: [blunder] }), 1);
  await withServer(server, async (base) => {
    const refreshed = await (await fetch(`${base}/api/puzzles/refresh`, { method: "POST" })).json();
    assert.deepEqual(refreshed, { created: 1, updated: 0, removed: 0, total: 1 });

    const list = await (await fetch(`${base}/api/puzzles?mode=due`)).json();
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0].opponent, "rival");
    assert.equal(list.analysedGames, 1);
    assert.deepEqual(list.counts, { total: 1, due: 1, solved: 0, retired: 0 });
    assert.doesNotMatch(JSON.stringify(list), /e2e4/);

    const bad = await fetch(`${base}/api/puzzles?tag=pin`);
    assert.equal(bad.status, 400);
    assert.match((await bad.json()).error, /unknown tag/);
  });
});
