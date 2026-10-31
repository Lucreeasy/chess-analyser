import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, putCachedEval } from "../../src/server/db.ts";
import { epdOf } from "../../src/server/analysis/book.ts";
import { UciEngine } from "../../src/server/engine/engine.ts";
import { runAnalysis } from "../../src/server/runAnalysis.ts";

const FAKE_ENGINE = new URL("../fixtures/fake-engine.ts", import.meta.url).pathname;
const PGN = '[White "a"]\n[Black "b"]\n[Result "1-0"]\n\n1. e4 e5 1-0';

test("runAnalysis replays a PGN, asks the engine for each position, and caches the results", async () => {
  const db = openDb(":memory:");
  const engine = new UciEngine("node", [FAKE_ENGINE]);
  await engine.start({ threads: 1, hashMb: 16 });
  try {
    const result = await runAnalysis(db, engine, PGN, { depth: 16, engineName: "FakeEngine" });
    assert.equal(result.moves.length, 2);
    assert.equal(result.moves[0].classification, "book"); // 1.e4 is in the opening book
    assert.equal(result.summary.engine, "FakeEngine");
    assert.deepEqual(result.moves[0].bestLine, { cp: 30, pv: ["e2e4", "e7e5"] });
  } finally {
    await engine.quit();
  }
});

// docs/03-IMPORT-SPEC.md section 5.6: progress/plyEval events, one per position, ply 0 = start position.
test("onPosition is called once per position, ply 0 through plyCount", async () => {
  const db = openDb(":memory:");
  const engine = new UciEngine("node", [FAKE_ENGINE]);
  await engine.start({ threads: 1, hashMb: 16 });
  try {
    const calls: Array<[number, number]> = [];
    await runAnalysis(db, engine, PGN, {
      depth: 16,
      engineName: "FakeEngine",
      onPosition: (ply, totalPlies) => calls.push([ply, totalPlies]),
    });
    assert.deepEqual(calls, [
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  } finally {
    await engine.quit();
  }
});

test("a position already in the cache is used instead of asking the engine again", async () => {
  const db = openDb(":memory:");
  const engine = new UciEngine("node", [FAKE_ENGINE]);
  await engine.start({ threads: 1, hashMb: 16 });
  try {
    // A line the fake engine itself would never produce, so finding it in the result proves the
    // cache was read instead of a fresh engine call.
    const distinctiveLine = [{ cp: 777, pv: ["g1f3"] }];
    putCachedEval(db, epdOf("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"), 16, 2, distinctiveLine, 16);

    const result = await runAnalysis(db, engine, PGN, { depth: 16, engineName: "FakeEngine" });
    assert.deepEqual(result.moves[0].bestLine, { cp: 777, pv: ["g1f3"] });
  } finally {
    await engine.quit();
  }
});
