import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, insertGames, getQueueEntry, getAnalysis, getAnalysisError, getQueueState, setPaused } from "../../../src/server/db.ts";
import { enqueueGames } from "../../../src/server/analysisQueue/queue.ts";
import { AnalysisWorker, type WorkerEvent } from "../../../src/server/analysisQueue/worker.ts";
import { UciEngine } from "../../../src/server/engine/engine.ts";
import type { StoredGame } from "../../../src/server/import/parseGame.ts";
import { waitFor } from "../testServer.ts";

const FAKE_ENGINE = new URL("../../fixtures/fake-engine.ts", import.meta.url).pathname;

function game(overrides: Partial<StoredGame>): StoredGame {
  return {
    id: "a",
    source: "file",
    pgn: '[White "a"]\n[Black "b"]\n[Result "1-0"]\n\n1. e4 e5 1-0',
    tags: {},
    white: "a",
    black: "b",
    result: "1-0",
    timeControlText: "-",
    timeClass: "classical",
    playedAt: 1,
    plyCount: 2,
    importedAt: 1,
    analysisStatus: "none",
    ...overrides,
  };
}

async function withEngine<T>(run: (getEngine: () => Promise<UciEngine>) => Promise<T>): Promise<T> {
  const engine = new UciEngine("node", [FAKE_ENGINE]);
  await engine.start({ threads: 1, hashMb: 16 });
  try {
    return await run(async () => engine);
  } finally {
    await engine.quit();
  }
}


test("notify() runs a queued game to completion and stores the analysis", async () => {
  await withEngine(async (getEngine) => {
    const db = openDb(":memory:");
    insertGames(db, [game({ id: "a" })]);
    enqueueGames(db, ["a"], "standard", false, false, 1000);

    const worker = new AnalysisWorker(db, getEngine, { now: () => 5000 });
    worker.notify();
    await waitFor(() => getAnalysis(db, "a") !== undefined);

    assert.equal(getQueueEntry(db, "a"), undefined);
    assert.equal(getAnalysis(db, "a")?.finishedAt, 5000);
    assert.equal(getQueueState(db).done, 1);
    await worker.stop();
  });
});

test("events: queue, progress and plyEval fire, then gameAnalysed", async () => {
  await withEngine(async (getEngine) => {
    const db = openDb(":memory:");
    insertGames(db, [game({ id: "a" })]);
    enqueueGames(db, ["a"], "standard", false, false, 1000);

    const events: WorkerEvent[] = [];
    const worker = new AnalysisWorker(db, getEngine, { onEvent: (e) => events.push(e) });
    worker.notify();
    await waitFor(() => events.some((e) => e.type === "gameAnalysed"));

    assert.ok(events.some((e) => e.type === "progress" && e.gameId === "a" && e.ply === 0));
    assert.ok(events.some((e) => e.type === "plyEval" && e.gameId === "a"));
    assert.ok(events.some((e) => e.type === "queue" && e.status.running?.gameId === "a"));
    await worker.stop();
  });
});

test("a game that fails to replay is recorded as an error; the queue entry is gone", async () => {
  await withEngine(async (getEngine) => {
    const db = openDb(":memory:");
    insertGames(db, [game({ id: "a", pgn: '[White "a"]\n[Black "b"]\n[Result "1-0"]\n\n1. Qxh7 1-0' })]);
    enqueueGames(db, ["a"], "standard", false, false, 1000);

    const worker = new AnalysisWorker(db, getEngine, { now: () => 9000 });
    worker.notify();
    await waitFor(() => getAnalysisError(db, "a") !== undefined);

    assert.equal(getQueueEntry(db, "a"), undefined);
    assert.equal(getAnalysis(db, "a"), undefined);
    assert.equal(getQueueState(db).done, 0); // an error never increments done
    await worker.stop();
  });
});

test("pause() aborts the running game back to waiting; resume() continues it", async () => {
  await withEngine(async (getEngine) => {
    const db = openDb(":memory:");
    insertGames(db, [game({ id: "a" })]);
    enqueueGames(db, ["a"], "standard", false, false, 1000);

    let pausedOnce = false;
    const worker = new AnalysisWorker(db, getEngine, {
      onEvent: (e) => {
        if (!pausedOnce && e.type === "progress" && e.ply === 0) {
          pausedOnce = true;
          worker.pause();
        }
      },
    });
    worker.notify();
    await waitFor(() => getQueueEntry(db, "a") !== undefined && !getQueueEntry(db, "a")!.running);

    assert.equal(getQueueState(db).paused, true);
    assert.equal(getAnalysis(db, "a"), undefined); // no partial result saved
    assert.equal(getAnalysisError(db, "a"), undefined); // not an error

    worker.resume();
    await waitFor(() => getAnalysis(db, "a") !== undefined);
    assert.equal(getQueueEntry(db, "a"), undefined);
    await worker.stop();
  });
});

test("status(): pending/done/total before, during and after a run", async () => {
  await withEngine(async (getEngine) => {
    const db = openDb(":memory:");
    insertGames(db, [game({ id: "a" }), game({ id: "b" })]);
    enqueueGames(db, ["a", "b"], "standard", false, false, 1000);

    const worker = new AnalysisWorker(db, getEngine);
    assert.deepEqual(worker.status(), { paused: false, pending: 2, done: 0, total: 2, running: null });

    worker.notify();
    await waitFor(() => getAnalysis(db, "a") !== undefined && getAnalysis(db, "b") !== undefined);
    assert.deepEqual(worker.status(), { paused: false, pending: 0, done: 2, total: 2, running: null });
    await worker.stop();
  });
});

test("while paused, new games can still be queued and wait", async () => {
  await withEngine(async (getEngine) => {
    const db = openDb(":memory:");
    insertGames(db, [game({ id: "a" })]);
    setPaused(db, true);

    const worker = new AnalysisWorker(db, getEngine);
    const queued = enqueueGames(db, ["a"], "standard", false, false, 1000);
    worker.notify();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(queued, 1);
    assert.equal(getQueueEntry(db, "a")?.running, false); // accepted, but not run while paused
    assert.equal(getAnalysis(db, "a"), undefined);
    await worker.stop();
  });
});
