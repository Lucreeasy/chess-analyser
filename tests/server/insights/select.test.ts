import { test } from "node:test";
import assert from "node:assert/strict";
import { selectGames, matchesFilters, type GameWithAnalysis } from "../../../src/server/insights/select.ts";
import { makeGame, makeAnalysis } from "./fixtures.ts";

/** n usable games (3 moves of mine, one move row each), ids g00.., played one minute apart. */
function usable(n: number, start = 0): GameWithAnalysis[] {
  return Array.from({ length: n }, (_, i) => ({
    game: makeGame({ id: `g${String(start + i).padStart(2, "0")}`, playedAt: (start + i) * 60_000 }),
    analysis: makeAnalysis({ myMoves: 3, moves: [{}] }),
  }));
}

test("section 2: exclusions are counted per reason, in order, and the gate needs 20 usable games", () => {
  const games: GameWithAnalysis[] = [
    ...usable(19),
    { game: makeGame({ id: "noColour", myColour: undefined }), analysis: makeAnalysis({ myMoves: 10 }) },
    { game: makeGame({ id: "noAnalysis" }) },
    { game: makeGame({ id: "short" }), analysis: makeAnalysis({ myMoves: 2 }) },
    { game: makeGame({ id: "noColourNoAnalysis", myColour: undefined }) },
  ];
  const selection = selectGames(games, {});
  assert.equal(selection.gamesTotal, 23);
  assert.deepEqual(selection.excluded, { notAnalysed: 1, noMyColor: 2, tooShort: 1 });
  assert.equal(selection.analysed, 19);
  assert.equal(selection.ready, false);
  assert.equal(selection.needed, 1);
  assert.deepEqual(selection.used, []);
});

test("section 2: exactly 3 of my moves counts; 20 usable games are ready, in play order", () => {
  const games = usable(20).reverse();
  const selection = selectGames(games, {});
  assert.equal(selection.ready, true);
  assert.equal(selection.needed, 0);
  assert.deepEqual(
    selection.used.map((u) => u.game.id),
    usable(20).map((g) => g.game.id),
  );
});

test("section 2: equal played-at times are ordered by id, plain string order", () => {
  const games = usable(20).map((g, i) => ({ ...g, game: { ...g.game, playedAt: 0, id: i === 0 ? "b" : i === 1 ? "B" : g.game.id } }));
  const ids = selectGames(games, {}).used.map((u) => u.game.id);
  assert.equal(ids.indexOf("B") < ids.indexOf("b"), true);
});

test("section 2 steps 7-8: a usable game without move rows moves to notAnalysed and the gate is checked again", () => {
  const games = [...usable(19), { game: makeGame({ id: "empty", playedAt: 1 }), analysis: makeAnalysis({ myMoves: 5 }) }];
  const selection = selectGames(games, {});
  assert.equal(selection.excluded.notAnalysed, 1);
  assert.equal(selection.analysed, 19);
  assert.equal(selection.ready, false);
});

test("section 3: each filter, inclusive dates, results need a finished game", () => {
  const game = makeGame({ id: "a", timeClass: "rapid", myColour: "b", myResult: "draw", openingFamily: "Sicilian Defense", playedAt: 1000 });
  assert.equal(matchesFilters(game, { timeClasses: ["blitz", "rapid"] }), true);
  assert.equal(matchesFilters(game, { timeClasses: ["blitz"] }), false);
  assert.equal(matchesFilters(game, { colour: "w" }), false);
  assert.equal(matchesFilters(game, { results: ["draw"] }), true);
  assert.equal(matchesFilters({ ...game, myResult: undefined }, { results: ["win", "loss", "draw"] }), false);
  assert.equal(matchesFilters(game, { family: "Sicilian Defense" }), true);
  assert.equal(matchesFilters(game, { family: "Sicilian" }), false);
  assert.equal(matchesFilters(game, { from: 1000, to: 1000 }), true);
  assert.equal(matchesFilters(game, { from: 1001 }), false);
  assert.equal(matchesFilters(game, { ids: ["x", "a"] }), true);
  assert.equal(matchesFilters(game, { ids: ["x"] }), false);
});
