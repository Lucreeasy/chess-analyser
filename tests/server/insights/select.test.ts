import { test } from "node:test";
import assert from "node:assert/strict";
import { selectGames, matchesFilters, defaultRange, type GameWithAnalysis } from "../../../src/server/insights/select.ts";
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

/** n usable games played at the given times. */
function playedAt(times: number[]): GameWithAnalysis[] {
  return times.map((t, i) => ({ game: makeGame({ id: `t${i}`, playedAt: t }), analysis: makeAnalysis({ myMoves: 3, moves: [{}] }) }));
}

const DAY_MS = 86_400_000;
const NOW = Date.UTC(2026, 9, 30, 12); // 30 Oct 2026 12:00 UTC
const D = Date.UTC(2026, 8, 30); // 30 Sept 2026 00:00 UTC

test("section 4: 20 usable games in the last 30 days -> kind days, from the start of that UTC day", () => {
  assert.deepEqual(defaultRange(playedAt(Array(20).fill(D)), {}, NOW), { kind: "days", from: D });
  assert.equal(defaultRange(playedAt([...Array(19).fill(D), D - 1]), {}, NOW).kind, "all");
});

test("section 4 example: 12 recent of 45, the 30th newest on 3 Sept 2026 18:40 -> kind games from 3 Sept 00:00", () => {
  const thirtieth = Date.UTC(2026, 8, 3, 18, 40);
  const times = [...Array(12).fill(D + 1000), ...Array(17).fill(thirtieth + 1000), thirtieth, ...Array(15).fill(thirtieth - DAY_MS * 10)];
  assert.equal(times.length, 45);
  assert.deepEqual(defaultRange(playedAt(times), {}, NOW), { kind: "games", from: Date.UTC(2026, 8, 3) });
});

test("section 4: fewer than 30 usable games -> kind all; it counts only usable games matching the other filters", () => {
  assert.deepEqual(defaultRange(playedAt(Array(29).fill(0)), {}, NOW), { kind: "all" });
  const games = [...playedAt(Array(20).fill(D)), { game: makeGame({ id: "x", playedAt: D }) }];
  assert.equal(defaultRange(games, { colour: "b" }, NOW).kind, "all");
  assert.equal(defaultRange(games, { from: 0, to: 1 }, NOW).kind, "days"); // its own dates are ignored
});
