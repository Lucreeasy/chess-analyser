import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultFilters, matchesFilters, filterGames, activeFilterCount, computeFacets, filtersFromQuery } from "../../../src/web/lib/gamesFilter.ts";
import type { GameRow } from "../../../src/web/lib/types.ts";

function game(overrides: Partial<GameRow>): GameRow {
  return {
    id: "a",
    white: "alice",
    black: "bob",
    result: "1-0",
    timeControlText: "180+2",
    timeClass: "blitz",
    playedAt: Date.UTC(2026, 2, 15),
    plyCount: 10,
    analysisStatus: "none",
    opponent: "bob",
    opponentRating: undefined,
    accuracy: undefined,
    blunders: undefined,
    myColour: "w",
    myResult: "win",
    ...overrides,
  };
}

// docs/06-GAMES-SPEC.md section A5.
test("search: matches the opponent name, opening name, ECO, case-insensitive substring", () => {
  const g = game({ opponent: "Carol", openingName: "Sicilian Defense: Najdorf", eco: "B90" });
  assert.equal(matchesFilters(g, { ...defaultFilters(), search: "carol" }), true);
  assert.equal(matchesFilters(g, { ...defaultFilters(), search: "najdorf" }), true);
  assert.equal(matchesFilters(g, { ...defaultFilters(), search: "b90" }), true);
  assert.equal(matchesFilters(g, { ...defaultFilters(), search: "nonsense" }), false);
});

test("search: when my colour is unknown, both players' names are searched", () => {
  const g = game({ myColour: undefined, myResult: undefined, white: "dave", black: "erin", opponent: undefined });
  assert.equal(matchesFilters(g, { ...defaultFilters(), search: "dave" }), true);
  assert.equal(matchesFilters(g, { ...defaultFilters(), search: "erin" }), true);
});

test("search: does not match time class, result, rating or opening family alone", () => {
  const g = game({ timeClass: "blitz", openingFamily: "Sicilian Defense", opponentRating: 1500 });
  assert.equal(matchesFilters(g, { ...defaultFilters(), search: "blitz" }), false);
  assert.equal(matchesFilters(g, { ...defaultFilters(), search: "sicilian defense" }), false); // family alone, not the full opening name
  assert.equal(matchesFilters(g, { ...defaultFilters(), search: "1500" }), false);
});

// docs/06-GAMES-SPEC.md section A6.
test("time class filter: none selected is no filter; otherwise any selected class matches", () => {
  const g = game({ timeClass: "bullet" });
  assert.equal(matchesFilters(g, defaultFilters()), true);
  assert.equal(matchesFilters(g, { ...defaultFilters(), timeClasses: new Set(["bullet", "blitz"]) }), true);
  assert.equal(matchesFilters(g, { ...defaultFilters(), timeClasses: new Set(["blitz"]) }), false);
});

test("colour filter: unknown colour never matches White or Black", () => {
  const g = game({ myColour: undefined });
  assert.equal(matchesFilters(g, { ...defaultFilters(), colour: "w" }), false);
  assert.equal(matchesFilters(g, { ...defaultFilters(), colour: "b" }), false);
  assert.equal(matchesFilters(g, { ...defaultFilters(), colour: "any" }), true);
});

test("result filter: matches my result; unknown/unfinished never match when a chip is on", () => {
  const win = game({ myResult: "win" });
  const unfinished = game({ myResult: undefined });
  assert.equal(matchesFilters(win, { ...defaultFilters(), results: new Set(["win"]) }), true);
  assert.equal(matchesFilters(win, { ...defaultFilters(), results: new Set(["loss"]) }), false);
  assert.equal(matchesFilters(unfinished, { ...defaultFilters(), results: new Set(["win"]) }), false);
});

test("analysis filter: analysed = done; not analysed = any other status", () => {
  for (const status of ["none", "queued", "running", "error"] as const) {
    const g = game({ analysisStatus: status });
    assert.equal(matchesFilters(g, { ...defaultFilters(), analysis: "not_analysed" }), true);
    assert.equal(matchesFilters(g, { ...defaultFilters(), analysis: "analysed" }), false);
  }
  const done = game({ analysisStatus: "done" });
  assert.equal(matchesFilters(done, { ...defaultFilters(), analysis: "analysed" }), true);
  assert.equal(matchesFilters(done, { ...defaultFilters(), analysis: "not_analysed" }), false);
});

test("opening family filter: exact match", () => {
  const g = game({ openingFamily: "Sicilian Defense" });
  assert.equal(matchesFilters(g, { ...defaultFilters(), openingFamily: "Sicilian Defense" }), true);
  assert.equal(matchesFilters(g, { ...defaultFilters(), openingFamily: "French Defense" }), false);
});

test("date range: inclusive, either bound alone works", () => {
  const g = game({ playedAt: Date.UTC(2026, 2, 15, 12) });
  assert.equal(matchesFilters(g, { ...defaultFilters(), from: Date.UTC(2026, 2, 15) }), true);
  assert.equal(matchesFilters(g, { ...defaultFilters(), from: Date.UTC(2026, 2, 16) }), false);
  assert.equal(matchesFilters(g, { ...defaultFilters(), to: Date.UTC(2026, 2, 15, 23, 59, 59, 999) }), true);
  assert.equal(matchesFilters(g, { ...defaultFilters(), to: Date.UTC(2026, 2, 14, 23, 59, 59, 999) }), false);
});

test("filters combine with AND", () => {
  const g = game({ timeClass: "blitz", myColour: "w", myResult: "win" });
  assert.equal(matchesFilters(g, { ...defaultFilters(), timeClasses: new Set(["blitz"]), colour: "w" }), true);
  assert.equal(matchesFilters(g, { ...defaultFilters(), timeClasses: new Set(["bullet"]), colour: "w" }), false);
});

test("filterGames filters a list", () => {
  const games = [game({ id: "a", timeClass: "blitz" }), game({ id: "b", timeClass: "bullet" })];
  const result = filterGames(games, { ...defaultFilters(), timeClasses: new Set(["blitz"]) });
  assert.deepEqual(result.map((g) => g.id), ["a"]);
});

// docs/06-GAMES-SPEC.md section A6: active-filter count.
test("activeFilterCount: one per category, date range counts once regardless of one or two bounds", () => {
  assert.equal(activeFilterCount(defaultFilters()), 0);
  assert.equal(activeFilterCount({ ...defaultFilters(), timeClasses: new Set(["blitz"]) }), 1);
  assert.equal(activeFilterCount({ ...defaultFilters(), from: 1, to: 2 }), 1);
  assert.equal(
    activeFilterCount({
      ...defaultFilters(),
      timeClasses: new Set(["blitz"]),
      colour: "w",
      results: new Set(["win"]),
      analysis: "analysed",
      openingFamily: "Sicilian",
      search: "x",
      from: 1,
    }),
    7,
  );
});

// docs/06-GAMES-SPEC.md section A7.
test("computeFacets: time classes present, opening families sorted by count desc then name", () => {
  const games = [
    game({ id: "a", timeClass: "blitz", openingFamily: "Sicilian Defense" }),
    game({ id: "b", timeClass: "blitz", openingFamily: "Sicilian Defense" }),
    game({ id: "c", timeClass: "bullet", openingFamily: "French Defense" }),
    game({ id: "d", timeClass: "bullet", openingFamily: "Caro-Kann" }),
    game({ id: "e", timeClass: "rapid", openingFamily: undefined }),
  ];
  const facets = computeFacets(games);
  assert.deepEqual([...facets.timeClasses].sort(), ["blitz", "bullet", "rapid"]);
  assert.deepEqual(facets.openingFamilies, [
    { family: "Sicilian Defense", count: 2 },
    { family: "Caro-Kann", count: 1 },
    { family: "French Defense", count: 1 },
  ]);
});

test("filtersFromQuery: an Insights drill-down with exact ids and a label", () => {
  const filters = filtersFromQuery("ids=a,c,a&label=Games+with+errors");
  assert.deepEqual([...filters.ids!], ["a", "c"]); // duplicates dropped
  assert.equal(filters.label, "Games with errors");
  assert.equal(filters.approximate, false);
  assert.deepEqual(filterGames([game({ id: "a" }), game({ id: "b" }), game({ id: "c" })], filters).map((g) => g.id), ["a", "c"]);
  assert.equal(activeFilterCount(filters), 0); // the id list is shown as a chip, not counted
});

test("filtersFromQuery: the library's own analysis filter and approximate flag; an empty query is the default view", () => {
  const filters = filtersFromQuery("timeClass=blitz&colour=b&analysis=analysed&approx=1");
  assert.deepEqual([...filters.timeClasses], ["blitz"]);
  assert.equal(filters.colour, "b");
  assert.equal(filters.analysis, "analysed");
  assert.equal(filters.approximate, true);
  assert.deepEqual(filtersFromQuery(""), defaultFilters());
});

test("activeFilterCount: an explicit All time counts only when nothing else is active (Insights)", () => {
  assert.equal(activeFilterCount({ ...defaultFilters(), allTime: true }), 1);
  assert.equal(activeFilterCount({ ...defaultFilters(), allTime: true, colour: "w" }), 1);
  assert.equal(activeFilterCount({ ...defaultFilters(), allTime: true, colour: "w", openingFamily: "French Defense" }), 2);
});

test("filtersFromQuery reads the Insights allTime flag", () => {
  assert.equal(filtersFromQuery("allTime=1").allTime, true);
  assert.equal(filtersFromQuery("colour=w").allTime, false);
});
