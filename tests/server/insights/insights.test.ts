import { test } from "node:test";
import assert from "node:assert/strict";
import { computeInsights } from "../../../src/server/insights/insights.ts";
import { parseInsightsQuery } from "../../../src/server/insights/select.ts";
import type { GameWithAnalysis } from "../../../src/server/insights/select.ts";
import { makeGame, makeAnalysis, seededGames } from "./fixtures.ts";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 30, 12);

/** n usable games, one per day back from NOW, one move row of mine each. */
function library(n: number): GameWithAnalysis[] {
  return Array.from({ length: n }, (_, i) => ({
    game: makeGame({ id: `g${i}`, playedAt: NOW - (i + 1) * DAY, openingFamily: i % 2 ? "French Defense" : "Sicilian Defense" }),
    analysis: makeAnalysis({ myMoves: 3, moves: [{ winPercentBefore: 50, winPercentAfter: 50, epLoss: 0, san: "e4", uci: "e2e4", fenBefore: "x" }, { san: "e5" }] }),
  }));
}

test("parseInsightsQuery: lists, dates and colour; unknown values are dropped; ids capped at 500", () => {
  const q = parseInsightsQuery(new URLSearchParams("timeClass=blitz,nope&colour=x&result=win,maybe&family=French Defense&from=5&to=abc&allTime=1"));
  assert.deepEqual(q, {
    filters: { timeClasses: ["blitz"], colour: undefined, results: ["win"], family: "French Defense", from: 5, to: undefined, ids: undefined },
    allTime: true,
  });
  const ids = ["i0", ...Array.from({ length: 600 }, (_, i) => `i${i}`)].join(",");
  const parsed = parseInsightsQuery(new URLSearchParams(`ids=${ids}`)).filters.ids!;
  assert.equal(parsed.length, 500); // distinct ids, at most 500
  assert.deepEqual(parsed.slice(0, 2), ["i0", "i1"]);
});

test("not ready below 20 games: the counts and the library facts only", () => {
  const r = computeInsights(library(19), { filters: {}, allTime: true }, NOW);
  assert.equal(r.ready, false);
  assert.equal(r.needed, 1);
  assert.deepEqual(r.library.families, [{ name: "Sicilian Defense", count: 10 }, { name: "French Defense", count: 9 }]);
  assert.equal("overview" in r, false);
});

test("ready: every section is present, game arrays become counts", () => {
  const r = computeInsights(library(25), { filters: {}, allTime: true }, NOW);
  assert.equal(r.ready, true);
  if (!r.ready) return;
  assert.equal(r.analysed, 25);
  assert.equal(r.overview.games, 25);
  assert.equal(r.openings.white[0].games, 13);
  assert.equal(r.openings.white[0].list, "opening:Sicilian Defense:w");
  assert.equal(r.trend.length, 21);
  assert.equal(r.playstyle.axes.length, 5);
  assert.equal(r.lists.all.total, 25);
  assert.equal(typeof r.time.clocked, "number");
  assert.equal("reachedGames" in r.conversion, false);
});

test("section 4: the default range applies unless dates or All time are set; explicit dates win", () => {
  const defaulted = computeInsights(library(25), { filters: {}, allTime: false }, NOW);
  assert.equal(defaulted.defaultRange?.kind, "days"); // 20+ games in the last 30 days
  assert.equal(defaulted.filters.from, Date.UTC(2026, 8, 30)); // start of the UTC day 30 days before NOW
  assert.equal(defaulted.analysed, 25);
  const explicit = computeInsights(library(25), { filters: { from: NOW - 3 * DAY }, allTime: false }, NOW);
  assert.equal(explicit.defaultRange, undefined);
  assert.equal(explicit.gamesTotal, 3);
  assert.equal(computeInsights(library(25), { filters: {}, allTime: true }, NOW).defaultRange, undefined);
});

test("1,000 seeded analysed games: every section in under 500 ms, all numbers finite (NFR-3)", () => {
  // 50 seeded games repeated 20 times, each round 60 days later, keep the suite fast.
  const seeded = seededGames(50);
  const games = Array.from({ length: 20 }, (_, r) =>
    seeded.map(({ game, analysis }) => ({ game: { ...game, id: `${game.id}-${r}`, playedAt: game.playedAt + r * 60 * DAY }, analysis })),
  ).flat();
  const start = performance.now();
  const r = computeInsights(games, { filters: {}, allTime: true }, NOW);
  const elapsed = performance.now() - start;
  assert.ok(r.ready && r.analysed === 1000);
  assert.ok(r.recommendations.length > 0 && r.trend.length > 0);
  JSON.stringify(r, (_, v) => (typeof v === "number" && assert.ok(Number.isFinite(v)), v));
  assert.ok(elapsed < 500, `took ${Math.round(elapsed)} ms`);
});
