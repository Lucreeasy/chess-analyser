import { test } from "node:test";
import assert from "node:assert/strict";
import { timeStats } from "../../../src/server/insights/time.ts";
import { used } from "./fixtures.ts";

const close = (actual: number | undefined, expected: number) => assert.ok(Math.abs((actual ?? NaN) - expected) < 0.005, `${actual} != ${expected}`);

/** My (White) moves with the given time spent, each followed by an opponent move. */
function clockedGame(id: string, spentMs: number[]) {
  return used(id, { moves: spentMs.flatMap((t) => [{ timeSpentMs: t, clockMs: 60_000 }, {}]) });
}

test("8.1 example: two clocked games, ten timed moves each, one of 8 s and nineteen of 2 s", () => {
  const t = timeStats([clockedGame("a", [8000, ...Array(9).fill(2000)]), clockedGame("b", Array(10).fill(2000)), used("c", { moves: [{}, {}] })]);
  assert.equal(t.clocked.length, 2);
  close(t.secondsPerMove.value, 2.3);
  assert.deepEqual(t.under5s, { value: 0.95, n: 20, count: 19 });
  assert.deepEqual(t.byMoveNumber[0], { move: 1, seconds: { value: 5, n: 2 } });
  assert.equal(t.byMoveNumber.length, 10);
});

test("8.1: plies 1-20 only for the early average; move numbers above 60 are left out", () => {
  const t = timeStats([clockedGame("a", [...Array(10).fill(1000), ...Array(60).fill(3000)])]);
  assert.deepEqual(t.secondsPerMoveEarly, { value: 1, n: 10 });
  assert.equal(t.byMoveNumber.at(-1)?.move, 60);
});

test("8.1: time trouble share, blunder rates in and out of trouble, and their ratio", () => {
  const trouble = used("a", {
    moves: [
      { inTimeTrouble: true, classification: "blunder", clockMs: 5000 }, {},
      { inTimeTrouble: true, clockMs: 4000 }, {},
      { inTimeTrouble: false, clockMs: 60_000 }, {},
      { clockMs: 50_000 }, {}, // no flag: in neither rate
    ],
  });
  const calm = used("b", { moves: [{ inTimeTrouble: false, classification: "blunder", clockMs: 60_000 }, {}, { inTimeTrouble: false, clockMs: 60_000 }, {}] });
  const t = timeStats([trouble, calm]);
  assert.deepEqual(t.gamesInTrouble, { value: 0.5, n: 2, count: 1 });
  assert.deepEqual(t.troubleBlunders, { value: 50, n: 2, count: 1 });
  close(t.normalBlunders.value, 33.33);
  close(t.ratio, 1.5);
  assert.equal(timeStats([trouble]).ratio, undefined); // normal rate 0
});

test("8.1: lost on time counts over all my losses, clocks or not", () => {
  const t = timeStats([
    used("a", { game: { myResult: "loss", termination: "time" } }),
    used("b", { game: { myResult: "loss", termination: "resignation" } }),
    used("c", { game: { myResult: "win", termination: "time" } }),
  ]);
  assert.deepEqual(t.lostOnTime, { value: 0.5, n: 2, count: 1 });
  assert.deepEqual(t.clocked, []);
  assert.deepEqual(t.secondsPerMove, { value: undefined, n: 0 });
});
