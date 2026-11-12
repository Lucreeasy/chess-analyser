import { test } from "node:test";
import assert from "node:assert/strict";
import { UciEngine } from "../../../src/server/engine/engine.ts";

const FAKE_ENGINE = new URL("../../fixtures/fake-engine.ts", import.meta.url).pathname;
const STREAMING_FAKE_ENGINE = new URL("../../fixtures/streaming-fake-engine.ts", import.meta.url).pathname;

test("drives the handshake and a search against a scripted fake engine", async () => {
  const engine = new UciEngine("node", [FAKE_ENGINE]);
  await engine.start({ threads: 1, hashMb: 16 });
  try {
    const { lines, reachedDepth } = await engine.analyse(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "w",
      { depth: 16, multipv: 2, movetimeMs: 1000 },
    );
    assert.equal(reachedDepth, 10);
    assert.deepEqual(lines, [
      { cp: 30, pv: ["e2e4", "e7e5"] },
      { cp: 25, pv: ["d2d4", "d7d5"] },
    ]);
  } finally {
    await engine.quit();
  }
});

// A missing engine must fail with a clear message, nothing else broken.
test("start() rejects with a clear message when the engine program does not exist", async () => {
  const engine = new UciEngine("/no/such/engine-binary");
  await assert.rejects(engine.start({ threads: 1, hashMb: 16 }), /engine unavailable/);
});

test("exploreSearch: reports each newly-completed depth, then resolves once stopped", async () => {
  const engine = new UciEngine("node", [STREAMING_FAKE_ENGINE]);
  await engine.start({ threads: 1, hashMb: 16 });
  try {
    const progress: number[] = [];
    const controller = new AbortController();
    // Stop the search after a few depths have streamed in.
    setTimeout(() => controller.abort(), 40);

    const final = await engine.exploreSearch(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "w",
      { multipv: 2, depthTarget: 30, hardCapMs: 10000, signal: controller.signal },
      (result) => progress.push(result.reachedDepth),
    );

    assert.ok(progress.length > 0, "expected at least one progress callback");
    assert.deepEqual(progress, [...progress].sort((a, b) => a - b), "depths should only increase");
    assert.ok(final.reachedDepth >= progress[progress.length - 1]!);
    assert.deepEqual(final.lines[0], { cp: 30 + final.reachedDepth, pv: ["e2e4", "e7e5"] });
  } finally {
    await engine.quit();
  }
});

test("exploreSearch: the hard cap stops a search that never aborts", async () => {
  const engine = new UciEngine("node", [STREAMING_FAKE_ENGINE]);
  await engine.start({ threads: 1, hashMb: 16 });
  try {
    const controller = new AbortController();
    const started = Date.now();
    const final = await engine.exploreSearch(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "w",
      { multipv: 2, depthTarget: 30, hardCapMs: 30, signal: controller.signal },
      () => {},
    );
    assert.ok(Date.now() - started < 5000, "the hard cap should have stopped it well before depth 30's own pace would");
    assert.ok(final.reachedDepth < 30, "depth 30 is 150ms away at 5ms/depth; a 30ms cap should cut it short");
  } finally {
    await engine.quit();
  }
});

test("exploreSearch: a second search waits for the first instead of corrupting it (shared engine slot)", async () => {
  const engine = new UciEngine("node", [STREAMING_FAKE_ENGINE]);
  await engine.start({ threads: 1, hashMb: 16 });
  try {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const c1 = new AbortController();
    const c2 = new AbortController();
    setTimeout(() => c1.abort(), 20);
    setTimeout(() => c2.abort(), 40);

    const [first, second] = await Promise.all([
      engine.exploreSearch(fen, "w", { multipv: 2, depthTarget: 30, hardCapMs: 10000, signal: c1.signal }, () => {}),
      engine.exploreSearch(fen, "w", { multipv: 2, depthTarget: 30, hardCapMs: 10000, signal: c2.signal }, () => {}),
    ]);
    // Each call got its own clean depth-from-1 run (not lines mixed from both "go"s at once).
    assert.equal(first.lines[0]!.cp, 30 + first.reachedDepth);
    assert.equal(second.lines[0]!.cp, 30 + second.reachedDepth);
  } finally {
    await engine.quit();
  }
});
