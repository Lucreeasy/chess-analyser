import { test } from "node:test";
import assert from "node:assert/strict";
import { overview } from "../../../src/server/insights/overview.ts";
import { used } from "./fixtures.ts";

const close = (actual: number | undefined, expected: number) => assert.ok(Math.abs((actual ?? NaN) - expected) < 0.005, `${actual} != ${expected}`);

test("5.1: overall accuracy is the mean of my game accuracies; by colour and time class over those games", () => {
  const o = overview([
    used("a", { accuracy: 90, game: { timeClass: "blitz" } }),
    used("b", { accuracy: 70, game: { timeClass: "rapid" } }),
  ]);
  assert.deepEqual(o.accuracy, { value: 80, n: 2 });
  assert.deepEqual(o.accuracyByColour.b, { value: undefined, n: 0 });
  assert.deepEqual(o.accuracyByTimeClass, { blitz: { value: 90, n: 1 }, rapid: { value: 70, n: 1 } });
});

test("5.1 example: phase accuracy is the pooled harmonic mean, floored at 1", () => {
  const o = overview([
    used("a", { moves: [{ phase: "opening", accuracy: 100 }, { phase: "opening", accuracy: 0 }] }),
    used("b", { moves: [{ phase: "opening", accuracy: 50 }] }),
  ]);
  close(o.accuracyByPhase.opening.value, 66.67); // only my (White) moves: 100 and 50
  assert.equal(o.accuracyByPhase.opening.n, 2);
  assert.deepEqual(o.accuracyByPhase.endgame, { value: undefined, n: 0 });
  // A move of accuracy 0 counts as 1.
  assert.equal(overview([used("c", { moves: [{ phase: "endgame", accuracy: 0 }] })]).accuracyByPhase.endgame.value, 1);
});

test("5.2 example: 10 own moves with 2 Blunders, 1 Mistake, 1 Inaccuracy, 1 Miss", () => {
  const classes = ["blunder", "blunder", "mistake", "inaccuracy", "miss", "good", "good", "good", "good", "good"] as const;
  const moves = classes.flatMap((c) => [{ classification: c, phase: "middlegame" as const }, { classification: "blunder" as const }]);
  const o = overview([used("a", { moves })]);
  assert.deepEqual(o.errors.blunder, { value: 20, n: 10, count: 2 });
  assert.deepEqual(o.errors.mistake, { value: 10, n: 10, count: 1 });
  assert.deepEqual(o.errors.all, { value: 50, n: 10, count: 5 });
  assert.deepEqual(o.errorsByPhase.middlegame.all, { value: 50, n: 10, count: 5 });
  assert.equal(o.errorsByPhase.endgame.all.value, undefined);
  assert.equal(o.moves, 10);
});

test("5.3: tag shares over my tagged errors; the top tag breaks ties in tag order", () => {
  const o = overview([
    used("a", {
      moves: [
        { classification: "blunder", tag: "positional" }, {},
        { classification: "mistake", tag: "hung_piece" }, {},
        { classification: "good", tag: "missed_mate" }, {},
      ],
    }),
  ]);
  assert.deepEqual(o.tactics.hung_piece, { value: 0.5, n: 2, count: 1 });
  assert.equal(o.tactics.missed_mate.count, 0); // not an error class
  assert.equal(o.topTag, "hung_piece"); // tied with positional, earlier in tag order
  assert.equal(overview([used("b", { moves: [{}] })]).topTag, undefined);
});

test("5.4: an opponent Mistake/Blunder followed by my move is an opportunity; a strong reply punishes it", () => {
  const o = overview([
    used("a", {
      moves: [
        { classification: "good" },
        { classification: "blunder" }, // opportunity
        { classification: "best" }, // punished
        { classification: "mistake" }, // opportunity
        { classification: "good" }, // not punished
        { classification: "miss" }, // a Miss is no opportunity
        { classification: "best" },
        { classification: "blunder" }, // last ply: no opportunity
      ],
    }),
  ]);
  assert.deepEqual(o.punish, { value: 0.5, n: 2, count: 1 });
  assert.deepEqual(o.missed, { value: 0.5, n: 2, count: 1 });
});

test("5.5 example: consistency is the population SD; it needs 2 games", () => {
  const o = overview([90, 70, 80, 60].map((a, i) => used(`g${i}`, { accuracy: a })));
  close(o.consistency.value, 11.18);
  assert.equal(o.consistency.n, 4);
  assert.equal(overview([used("a")]).consistency.value, undefined);
});
