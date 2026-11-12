import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, putCachedEval } from "../../src/server/db.ts";
import { epdOf } from "../../src/server/analysis/book.ts";
import { UciEngine } from "../../src/server/engine/engine.ts";
import { runAnalysis, AnalysisAbortedError } from "../../src/server/runAnalysis.ts";

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

// The clock comments of the stored PGN reach the per-move clock data.
test("runAnalysis reads each move's [%clk] comment into clock, time spent and time trouble", async () => {
  const db = openDb(":memory:");
  const engine = new UciEngine("node", [FAKE_ENGINE]);
  await engine.start({ threads: 1, hashMb: 16 });
  try {
    const pgn = '[TimeControl "180"]\n[Result "*"]\n\n1. e4 {[%clk 0:02:58]} e5 {[%clk 0:00:09]} *';
    const result = await runAnalysis(db, engine, pgn, { depth: 16, engineName: "FakeEngine" });
    assert.equal(result.moves[0].clockMs, 178000);
    assert.equal(result.moves[0].timeSpentMs, 2000);
    assert.equal(result.moves[0].inTimeTrouble, false);
    assert.equal(result.moves[1].clockMs, 9000);
    assert.equal(result.moves[1].inTimeTrouble, true); // below max(10 % of 180 s, 10 s)
  } finally {
    await engine.quit();
  }
});

// Progress/plyEval events, one per position, ply 0 = start position.
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

// Pause aborts the running game; no partial result is saved.
test("an already-aborted signal stops analysis before the first engine call", async () => {
  const db = openDb(":memory:");
  const engine = new UciEngine("node", [FAKE_ENGINE]);
  await engine.start({ threads: 1, hashMb: 16 });
  try {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      () => runAnalysis(db, engine, PGN, { depth: 16, engineName: "FakeEngine", signal: controller.signal }),
      AnalysisAbortedError,
    );
  } finally {
    await engine.quit();
  }
});

test("aborting mid-analysis stops before the next position", async () => {
  const db = openDb(":memory:");
  const engine = new UciEngine("node", [FAKE_ENGINE]);
  await engine.start({ threads: 1, hashMb: 16 });
  try {
    const controller = new AbortController();
    let calls = 0;
    await assert.rejects(
      () =>
        runAnalysis(db, engine, PGN, {
          depth: 16,
          engineName: "FakeEngine",
          signal: controller.signal,
          onPosition: () => {
            calls++;
            if (calls === 1) controller.abort();
          },
        }),
      AnalysisAbortedError,
    );
    assert.equal(calls, 1); // stopped after the first position, before the second
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
