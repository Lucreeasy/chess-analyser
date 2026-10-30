import { test } from "node:test";
import assert from "node:assert/strict";
import { UciEngine } from "../../../src/server/engine/engine.ts";

const FAKE_ENGINE = new URL("../../fixtures/fake-engine.ts", import.meta.url).pathname;

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

// docs/01-REQUIREMENTS.md ANA-6: a missing engine must fail with a clear message, nothing else broken.
test("start() rejects with a clear message when the engine program does not exist", async () => {
  const engine = new UciEngine("/no/such/engine-binary");
  await assert.rejects(engine.start({ threads: 1, hashMb: 16 }), /engine unavailable/);
});
