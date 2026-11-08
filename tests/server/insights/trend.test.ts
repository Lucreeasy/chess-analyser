import { test } from "node:test";
import assert from "node:assert/strict";
import { trend } from "../../../src/server/insights/trend.ts";
import { used } from "./fixtures.ts";

const games = (n: number) => Array.from({ length: n }, (_, i) => used(`g${i}`, { accuracy: 50 + i, game: { playedAt: i * 1000 } }));

test("10.1 example: 25 games with accuracies 50..74 give 21 points", () => {
  const points = trend(games(25));
  assert.equal(points.length, 21);
  assert.deepEqual(points[0], { k: 5, gameId: "g4", playedAt: 4000, n: 5, accuracy: 52, rating: undefined, from: 0, to: 4000 });
  assert.equal(points.at(-1)?.accuracy, 64.5);
  assert.equal(points.at(-1)?.n, 20);
  assert.equal(points.at(-1)?.from, 5000); // games 6..25
});

test("10.1: the rating is the mean of my ratings among the window's games that have one", () => {
  const g = games(5).map((u, i) => ({ ...u, game: { ...u.game, whiteElo: i < 2 ? 1500 + i * 100 : undefined, blackElo: 2000 } }));
  assert.equal(trend(g)[0].rating, 1550);
  assert.equal(trend(games(5))[0].rating, undefined);
});

test("10.1 example: 420 games -> 416 points thinned to 300, at games 5, 6, 8, ..., 419, 420", () => {
  const points = trend(games(420));
  assert.equal(points.length, 300);
  assert.deepEqual(points.slice(0, 3).map((p) => p.k), [5, 6, 8]);
  assert.deepEqual(points.slice(-2).map((p) => p.k), [419, 420]);
  assert.deepEqual(trend(games(4)), []);
});
