import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer } from "./testServer.ts";
import { insertGames, finishAnalysis } from "../../src/server/db.ts";
import { makeGame, makeAnalysis } from "./insights/fixtures.ts";

process.env.NODE_ENV = "test";
const { server, db } = await import("../../src/server/index.ts");

test("GET /api/insights: not ready with too few games, then the profile once 20 are analysed", async () => {
  const games = Array.from({ length: 20 }, (_, i) => makeGame({ id: `r${i}`, playedAt: Date.now() - (i + 1) * 3_600_000 }));
  insertGames(db, games);
  await withServer(server, async (base) => {
    const before = await (await fetch(`${base}/api/insights?allTime=1`)).json();
    assert.deepEqual([before.ready, before.gamesTotal, before.excluded.notAnalysed], [false, 20, 20]);

    const analysis = makeAnalysis({ myMoves: 3, moves: [{ san: "e4", uci: "e2e4", fenBefore: "x", winPercentBefore: 50, winPercentAfter: 50, epLoss: 0 }, { san: "e5" }] });
    for (const g of games) finishAnalysis(db, g.id, "standard", analysis, 1);
    const after = await (await fetch(`${base}/api/insights?allTime=1&colour=w`)).json();
    assert.equal(after.ready, true);
    assert.equal(after.analysed, 20);
    assert.equal(after.lists.all.total, 20);
  });
});
