import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAnswer, puzzleEvaluator, type Evaluate } from "../../../src/server/puzzles/check.ts";
import type { Puzzle } from "../../../src/server/puzzles/store.ts";
import { cpFromWinPercent } from "../../../src/server/analysis/winPercent.ts";
import { openDb } from "../../../src/server/db.ts";
import type { UciEngine } from "../../../src/server/engine/engine.ts";

const NOW = Date.UTC(2026, 10, 10, 12);
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function puzzle(fields: Partial<Puzzle> = {}): Puzzle {
  return {
    id: "p",
    gameId: "g",
    ply: 1,
    fen: START,
    solution: ["e2e4", "d2d4"],
    phase: "opening",
    bestEp: 0.6,
    bestLine: ["e2e4", "e7e5", "g1f3"],
    playedSan: "a3",
    playedUci: "a2a3",
    playedClass: "blunder",
    epLoss: 0.3,
    dueAt: NOW,
    intervalDays: 0,
    attempts: 0,
    createdAt: NOW,
    playedAt: NOW,
    ...fields,
  };
}

/** Checks an answer that must be accepted for checking (not rejected), returning its result and schedule. */
async function answer(p: Puzzle, input: { move?: unknown; giveUp?: unknown }, evaluate: Evaluate) {
  const { result, schedule, error } = await checkAnswer(p, input, evaluate, NOW);
  if (!result || !schedule) throw new Error(`rejected: ${error}`);
  return { result, schedule };
}

/** An evaluator that answers White EP `ep` and counts its calls; `ep` undefined = engine unavailable. */
function fakeEvaluate(ep: number | undefined) {
  const calls: string[] = [];
  const evaluate: Evaluate = async (fen) => {
    calls.push(fen);
    return ep === undefined ? undefined : { cp: cpFromWinPercent(ep * 100) };
  };
  return { evaluate, calls };
}

test("both moves of the list are correct without an engine; a first-try solve retires the puzzle", async () => {
  const { evaluate, calls } = fakeEvaluate(0.1);
  const first = await answer(puzzle(), { move: "E2E4 " }, evaluate);
  assert.deepEqual([first.result.correct, first.result.acceptedBy, first.result.retired], [true, "solution", true]);
  assert.equal(first.result.explanation, "Correct: e4 is the engine's choice. In the game you played a3??.");
  const second = await answer(puzzle(), { move: "d2d4" }, evaluate);
  assert.equal(second.result.explanation, "Correct: d4 is as good as the engine's e4. In the game you played a3??.");
  assert.equal(calls.length, 0);
});

test("an off-list move 0.012 EP worse is correct within tolerance", async () => {
  const { evaluate } = fakeEvaluate(0.588);
  const r = await answer(puzzle({ tag: "hung_piece" }), { move: "c2c4" }, evaluate);
  assert.deepEqual([r.result.correct, r.result.acceptedBy], [true, "tolerance"]);
  assert.equal(
    r.result.explanation,
    "Not the engine's first choice (e4), but within 2% of it: c4 gives up only 1% of your winning chances. In the game you played a3??. It left a piece hanging.",
  );
});

test("an off-list move losing 0.31 is wrong and comes back tomorrow", async () => {
  const { evaluate } = fakeEvaluate(0.29);
  const r = await answer(puzzle({ tag: "hung_piece" }), { move: "h2h4" }, evaluate);
  assert.deepEqual([r.result.correct, r.result.acceptedBy, r.result.intervalDays, r.result.dueAt], [false, "none", 1, NOW + 86_400_000]);
  assert.equal(r.result.explanation, "h4 gives up 31% of your winning chances compared to e4. In the game you played a3??. It left a piece hanging.");
  assert.deepEqual(r.result.solutionSan, ["e4", "d4"]);
  assert.equal(r.result.attempt, "h2h4");
  assert.equal(r.result.bestLineText, "1. e4 e5 2. Nf3");
});

test("give up: a miss, no engine call, the engine's choice named", async () => {
  const { evaluate, calls } = fakeEvaluate(0.5);
  const r = await answer(puzzle(), { giveUp: true }, evaluate);
  assert.equal(r.result.explanation, "The engine's choice was e4. In the game you played a3??.");
  assert.deepEqual([r.result.correct, r.schedule.lastResult, r.result.attemptSan], [false, "missed", undefined]);
  assert.equal(calls.length, 0);
});

test("engine unavailable: an off-list move is wrong and strict; a list move is still correct, not strict", async () => {
  const { evaluate } = fakeEvaluate(undefined);
  const wrong = await answer(puzzle(), { move: "c2c4" }, evaluate);
  assert.deepEqual([wrong.result.correct, wrong.result.strict, wrong.result.epLoss], [false, true, undefined]);
  assert.match(wrong.result.explanation, /^c4 is not one of the accepted moves\. The engine prefers e4\./);
  const right = await answer(puzzle(), { move: "e2e4" }, evaluate);
  assert.deepEqual([right.result.correct, right.result.strict], [true, false]);
});

test("a mating move needs no engine and is correct within tolerance when it is off the list", async () => {
  const { evaluate, calls } = fakeEvaluate(0);
  const foolsMate = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2";
  const r = await answer(puzzle({ fen: foolsMate, solution: ["d7d5"], bestEp: 0.9 }), { move: "d8h4" }, evaluate);
  assert.deepEqual([r.result.correct, r.result.acceptedBy, r.result.epLoss], [true, "tolerance", 0]);
  assert.equal(calls.length, 0);
});

test("malformed, illegal and wrong-colour moves, and a non-boolean give-up, are rejected", async () => {
  const { evaluate } = fakeEvaluate(0.5);
  for (const input of [{ move: "e4" }, {}, { move: "e2e5" }, { move: "e7e5" }, { giveUp: "yes" }]) {
    assert.ok("error" in (await checkAnswer(puzzle(), input, evaluate, NOW)), JSON.stringify(input));
  }
});

test("the evaluator reuses a stored evaluation: the engine is asked once for a repeated position", async () => {
  const db = openDb(":memory:");
  let searches = 0;
  const engine = {
    analyse: async () => {
      searches++;
      return { lines: [{ cp: 20, pv: ["e7e5"] }], reachedDepth: 12 };
    },
  } as unknown as UciEngine;
  const evaluate = puzzleEvaluator(db, async () => engine);
  const after = "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1";
  assert.deepEqual(await evaluate(after), { cp: 20, pv: ["e7e5"] });
  assert.deepEqual(await evaluate(after), { cp: 20, pv: ["e7e5"] });
  assert.equal(searches, 1);
  const broken = puzzleEvaluator(db, async () => {
    throw new Error("no engine");
  });
  assert.equal(await broken("rnbqkbnr/pppppppp/8/8/8/2N5/PPPPPPPP/R1BQKBNR b KQkq - 1 1"), undefined);
});
