import { test } from "node:test";
import assert from "node:assert/strict";
import { ExploreSession, type ExploreEvent } from "../../../src/server/explore/session.ts";
import type { UciEngine } from "../../../src/server/engine/engine.ts";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** A fake engine whose exploreSearch is driven by the test: it resolves once `signal` aborts. */
function fakeEngine(): { engine: UciEngine; started: Promise<AbortSignal>[] } {
  const started: Promise<AbortSignal>[] = [];
  const engine = {
    exploreSearch: (_fen: string, _side: "w" | "b", options: { signal: AbortSignal }, onProgress: (r: unknown) => void) => {
      let resolveStarted: (signal: AbortSignal) => void;
      started.push(new Promise((r) => (resolveStarted = r)));
      resolveStarted!(options.signal);
      onProgress({ lines: [{ cp: 10, pv: ["e2e4"] }], reachedDepth: 5 });
      const final = { lines: [{ cp: 10, pv: ["e2e4"] }], reachedDepth: 5 };
      if (options.signal.aborted) return Promise.resolve(final);
      return new Promise((resolve) => {
        options.signal.addEventListener("abort", () => resolve(final));
      });
    },
  } as unknown as UciEngine;
  return { engine, started };
}

test("start: an illegal position is rejected synchronously, no event fires", () => {
  const events: ExploreEvent[] = [];
  const { engine } = fakeEngine();
  const session = new ExploreSession({ getEngine: async () => engine, onEvent: (e) => events.push(e) });

  const result = session.start({ fen: "not a fen", sideToMove: "w", clientId: "a", requestId: "r1" });
  assert.deepEqual(result, { ok: false, error: "invalid FEN: Invalid FEN: must contain six space-delimited fields" });
  assert.deepEqual(events, []);
});

test("start: a legal position starts a search; progress then done events fire", async () => {
  const events: ExploreEvent[] = [];
  const { engine } = fakeEngine();
  const session = new ExploreSession({ getEngine: async () => engine, onEvent: (e) => events.push(e) });

  const result = session.start({ fen: START, sideToMove: "w", clientId: "a", requestId: "r1" });
  assert.deepEqual(result, { ok: true });
  session.stop(); // triggers the fake engine's abort-driven resolution
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(events[0]!.type, "exploreProgress");
  assert.equal(events[1]!.type, "exploreDone");
  assert.equal((events[1] as { requestId: string }).requestId, "r1");
  // Each line also carries its move text, computed from the explored position.
  assert.equal((events[1] as { lines: { lineText: string }[] }).lines[0]!.lineText, "1. e4");
});

test("start: a different client's newer request displaces the old one, which is told 'engine busy'", async () => {
  const events: ExploreEvent[] = [];
  const { engine } = fakeEngine();
  const session = new ExploreSession({ getEngine: async () => engine, onEvent: (e) => events.push(e) });

  session.start({ fen: START, sideToMove: "w", clientId: "a", requestId: "r1" });
  session.start({ fen: START, sideToMove: "w", clientId: "b", requestId: "r2" });
  await new Promise((r) => setTimeout(r, 10));

  const busy = events.find((e) => e.type === "exploreBusy");
  assert.deepEqual(busy, { type: "exploreBusy", clientId: "a" });
});

test("start: the same client exploring a new position supersedes silently, no 'engine busy'", async () => {
  const events: ExploreEvent[] = [];
  const { engine } = fakeEngine();
  const session = new ExploreSession({ getEngine: async () => engine, onEvent: (e) => events.push(e) });

  session.start({ fen: START, sideToMove: "w", clientId: "a", requestId: "r1" });
  session.start({ fen: START, sideToMove: "w", clientId: "a", requestId: "r2" });
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(events.some((e) => e.type === "exploreBusy"), false);
});

test("stop: aborts whatever is currently running", async () => {
  const events: ExploreEvent[] = [];
  const { engine, started } = fakeEngine();
  const session = new ExploreSession({ getEngine: async () => engine, onEvent: (e) => events.push(e) });

  session.start({ fen: START, sideToMove: "w", clientId: "a", requestId: "r1" });
  await new Promise((r) => setTimeout(r, 0)); // let the async #run reach engine.exploreSearch
  const signal = await started[0]!;
  session.stop();
  assert.equal(signal.aborted, true);
});

test("a getEngine()/search failure fires exploreError with the failure message", async () => {
  const events: ExploreEvent[] = [];
  const session = new ExploreSession({
    getEngine: async () => {
      throw new Error("engine unavailable: boom");
    },
    onEvent: (e) => events.push(e),
  });

  session.start({ fen: START, sideToMove: "w", clientId: "a", requestId: "r1" });
  await new Promise((r) => setTimeout(r, 10));

  assert.deepEqual(events, [{ type: "exploreError", clientId: "a", requestId: "r1", message: "engine unavailable: boom" }]);
});
