import { test } from "node:test";
import assert from "node:assert/strict";
import { conversion, tilt } from "../../../src/server/insights/conversion.ts";
import type { PersonalResult } from "../../../src/server/import/players.ts";
import { used } from "./fixtures.ts";

const MIN = 60_000;

test("9.1 example: maximum EP 0.85 win, 0.80 draw, 0.79 win, 0.90 loss, 0.95 unfinished", () => {
  const games: [number, PersonalResult | undefined][] = [[0.85, "win"], [0.8, "draw"], [0.79, "win"], [0.9, "loss"], [0.95, undefined]];
  const { conversion: c } = conversion(games.map(([maxEp, r], i) => used(`g${i}`, { maxEp, game: { myResult: r } })));
  assert.deepEqual(c.reached, { value: 0.75, n: 4, count: 3 });
  assert.deepEqual(c.rate, { value: 1 / 3, n: 3, count: 1 });
  assert.deepEqual([c.won.count, c.drawn.count, c.lost.count], [1, 1, 1]);
  assert.deepEqual(c.reachedGames.map((u) => u.game.id), ["g0", "g1", "g3"]);
});

test("9.1: resilience counts minimum EP at or below 0.20; saved = won or drawn", () => {
  const games: [number, PersonalResult][] = [[0.2, "draw"], [0.1, "loss"], [0.05, "win"], [0.21, "loss"]];
  const { resilience: r } = conversion(games.map(([minEp, res], i) => used(`g${i}`, { minEp, game: { myResult: res } })));
  assert.deepEqual(r.reached, { value: 0.75, n: 4, count: 3 });
  assert.deepEqual(r.rate, { value: 2 / 3, n: 3, count: 2 });
  assert.deepEqual(conversion([]).conversion.rate, { value: undefined, n: 0, count: 0 });
});

test("9.3 example: loss 0 min, win 5 min, draw 15 min, loss 25 min, win 3 h later", () => {
  const games: [number, PersonalResult, number][] = [[0, "loss", 50], [5, "win", 60], [15, "draw", 90], [25, "loss", 70], [205, "win", 20]];
  const t = tilt(games.map(([at, r, accuracy], i) => used(`g${i}`, { accuracy, game: { myResult: r, playedAt: at * MIN } })));
  assert.deepEqual(t.afterLoss, { value: 60, n: 1 });
  assert.deepEqual(t.afterWin, { value: 90, n: 1 });
  assert.deepEqual(t.afterLossGames.map((u) => u.game.id), ["g1"]);
});

test("9.3: exactly 2 hours apart still counts; unfinished games start nothing", () => {
  const t = tilt([
    used("a", { game: { myResult: "loss", playedAt: 0 } }),
    used("b", { game: { playedAt: 120 * MIN } }),
    used("c", { game: { playedAt: 121 * MIN } }),
  ]);
  assert.equal(t.afterLoss.n, 1);
  assert.equal(t.afterWin.n, 0);
});
