import { test } from "node:test";
import assert from "node:assert/strict";
import { severity, positiveSeverity, depth, support, chooseEvidence, recommendations } from "../../../src/server/insights/recommendations.ts";
import { overview } from "../../../src/server/insights/overview.ts";
import { timeStats } from "../../../src/server/insights/time.ts";
import { conversion, tilt } from "../../../src/server/insights/conversion.ts";
import type { UsedGame } from "../../../src/server/insights/select.ts";
import type { MoveRecord } from "../../../src/server/analysis/game.ts";
import { used } from "./fixtures.ts";

const inputs = (games: UsedGame[]) => ({
  used: games,
  overview: overview(games),
  time: timeStats(games),
  conversion: conversion(games).conversion,
  tilt: tilt(games),
});
const only = (games: UsedGame[], id: string) => recommendations(inputs(games)).find((r) => r.id === id);

/** `games` games of `perGame` moves of mine each (with opponent replies); `mine(g, i)` overrides my i-th move of game g. */
function games(count: number, perGame: number, mine: (g: number, i: number) => Partial<MoveRecord> = () => ({})): UsedGame[] {
  return Array.from({ length: count }, (_, g) =>
    used(`g${String(g).padStart(2, "0")}`, {
      moves: Array.from({ length: perGame }, (_, i) => [{ epLoss: 0, ...mine(g, i) }, {}]).flat(),
    }),
  );
}

test("13.1 examples: severity, positive severity, depth and support", () => {
  assert.equal(severity(1, 0, 0), 25);
  assert.equal(severity(1, 1, 1), 100);
  assert.equal(severity(0.5, 1, 1), 63);
  assert.equal(severity(0.95, 1, 1), 96);
  assert.equal(positiveSeverity(0.4, 0.5), 11);
  assert.equal(depth(5, 2), 1);
  assert.equal(depth(NaN, 2), 0);
  assert.equal(support(-1, 10), 0);
});

test("13.1: evidence takes the best of each game first, then fills in list order; ties by game id, then ply", () => {
  const c = [
    { gameId: "b", ply: 3, score: 5 },
    { gameId: "b", ply: 1, score: 5 },
    { gameId: "a", ply: 9, score: 1 },
    { gameId: "c", ply: 2, score: 4 },
    { gameId: "c", ply: 4, score: 0 },
    { gameId: "d", ply: 1, score: 0 },
    { gameId: "e", ply: 1, score: 0 },
  ];
  assert.deepEqual(chooseEvidence(c).map((e) => `${e.gameId}${e.ply}`), ["b1", "c2", "a9", "d1", "e1"]);
  assert.deepEqual(chooseEvidence(c, false).map((e) => `${e.gameId}${e.ply}`), ["b1", "b3", "c2", "a9", "c4"]);
});

test("13.2 examples: 15 blunders in 600 moves; 9 fires, 8 does not; silent under 300 moves", () => {
  const blunders = (n: number) => (g: number, i: number) => (g * 20 + i < n ? { classification: "blunder" as const, epLoss: 0.3 } : {});
  const [r] = recommendations(inputs(games(30, 20, blunders(15))));
  assert.equal(r.id, "blunder-check");
  assert.equal(r.finding, "You blunder 2.5 times per 100 moves (15 blunders in 600 moves).");
  assert.equal(r.evidence.length, 5);
  assert.deepEqual(r.practice, { tag: undefined, label: "Puzzles from your own blunders" });
  assert.equal(recommendations(inputs(games(30, 20, blunders(9))))[0]?.id, "blunder-check");
  assert.deepEqual(recommendations(inputs(games(30, 20, blunders(8)))), []);
  assert.deepEqual(recommendations(inputs(games(14, 20, blunders(14)))), []);
});

test("13.2 example: 1,200 moves with 24 blunders -> severity 56", () => {
  const [r] = recommendations(inputs(games(60, 20, (g, i) => (i === 0 && g < 24 ? { classification: "blunder" } : {}))));
  assert.equal(r.severity, 56);
});

test("13.2: the hung-piece tag trigger and its practice tag", () => {
  const hung = (g: number, i: number) => (g < 10 && i === 0 ? { classification: "mistake" as const, tag: "hung_piece" as const, epLoss: 0.2 } : {});
  const [r] = recommendations(inputs(games(30, 20, hung)));
  assert.equal(
    r.finding,
    "Leaving a piece unprotected is your most common kind of mistake: 10 of your 10 tagged errors (100%), and you blunder 0.0 times per 100 moves.",
  );
  assert.equal(r.practice?.tag, "hung_piece");
});

test("13.3 example: the ratio variant, 20.0 in trouble against 0.5 otherwise", () => {
  // 40 clocked games of 20 moves; games 0-4 have 5 trouble moves with 1 blunder each; 4 more blunders outside trouble.
  const g = games(40, 20, (g, i) => ({
    clockMs: 60_000,
    inTimeTrouble: g < 5 && i >= 15,
    classification: (g < 5 && i === 19) || (g >= 36 && i === 0) ? "blunder" : "good",
  }));
  const r = recommendations(inputs(g)).find((x) => x.id === "time-trouble")!;
  assert.equal(r.finding, "You blunder 20.0 times per 100 moves when short of time, 38.8 times your normal rate of 0.5 (over 25 moves).");
  assert.equal(r.practice, undefined);
});

test("13.3 example: the share variant fires at 3 of 20 clocked games; 2 of 20 is silent", () => {
  const trouble = (n: number) => games(20, 5, (g, i) => ({ clockMs: 60_000, inTimeTrouble: g < n && i === 4 }));
  const r = recommendations(inputs(trouble(3))).find((x) => x.id === "time-trouble")!;
  assert.equal(r.finding, "You ran short of time in 15% of your 20 games with clocks (3 games).");
  assert.deepEqual(recommendations(inputs(trouble(2))), []);
});

test("13.4: middlegame minus endgame accuracy of exactly 8 fires; 7.5 does not", () => {
  // Accuracies with exact binary reciprocals, so the harmonic means (and the gap) are exact.
  const phases = (endgame: number) =>
    games(4, 30, (g, i) => (i < 15 ? { phase: "middlegame", accuracy: 16 } : { phase: "endgame", accuracy: endgame, epLoss: i / 100 }));
  const r = only(phases(8), "weak-endgames")!;
  assert.equal(r.finding, "Your endgame accuracy is 8.0, 8.0 points below your middlegame accuracy of 16.0 (from 60 endgame moves).");
  assert.deepEqual(r.practice, { phase: "endgame", label: "Endgame puzzles from your games" });
  assert.deepEqual(r.evidence.map((e) => e.ply), [59, 59, 59, 59, 57]); // pure top 5 by EP loss, ties by game id
  assert.equal(only(phases(8.5), "weak-endgames"), undefined);
});

test("13.5: 13 of 20 winning positions won fires; 9 reached is silent", () => {
  const results = (won: number, reached: number) =>
    games(reached, 3).map((u, i) => ({
      ...u,
      game: { ...u.game, myResult: i < won ? ("win" as const) : i % 2 ? ("draw" as const) : ("loss" as const) },
      analysis: { ...u.analysis, summary: { ...u.analysis.summary, maxEp: { w: 0.9, b: 0.1 } } },
    }));
  const r = only(results(13, 20), "poor-conversion")!;
  assert.equal(r.finding, "You reached a clearly winning position in 20 games but won only 13 of them (65%); 4 ended in a draw and 3 in a loss.");
  assert.equal(only(results(0, 9), "poor-conversion"), undefined);
  assert.ok(only(results(0, 10), "poor-conversion"));
});

test("13.5 evidence: my worst move after I first stood at 80% or more", () => {
  const slipped = used("x", {
    game: { myResult: "loss" },
    maxEp: 0.85,
    moves: [
      { winPercentAfter: 50, epLoss: 0 },
      { winPercentAfter: 85, epLoss: 0 },
      { winPercentAfter: 80, epLoss: 0.05 },
      { winPercentAfter: 80, epLoss: 0 },
      { winPercentAfter: 60, epLoss: 0.2 },
      { winPercentAfter: 60, epLoss: 0 },
    ],
  });
  const fillers = Array.from({ length: 9 }, (_, i) => used(`w${i}`, { game: { myResult: "loss" }, maxEp: 0.9, moves: [{ winPercentAfter: 90, epLoss: 0 }] }));
  const r = only([slipped, ...fillers], "poor-conversion")!;
  assert.deepEqual(r.evidence[0], { gameId: "x", ply: 5 });
});

test("13.8: 6 of 20 opponent errors unpunished fires; 5 of 20 does not; 19 opportunities is silent", () => {
  const chances = (unpunished: number, total: number) => [
    used("a", {
      moves: [{}, ...Array.from({ length: total }, (_, i) => [{ classification: "blunder" as const }, { classification: i < unpunished ? ("good" as const) : ("best" as const), epLoss: 0.1 }]).flat()],
    }),
  ];
  const r = only(chances(6, 20), "missed-chances")!;
  assert.equal(r.finding, "30% of your opponent's mistakes and blunders go unpunished (6 of 20).");
  assert.deepEqual(r.practice, { tag: "missed_tactic", label: "Tactics from your missed chances" });
  assert.equal(only(chances(5, 20), "missed-chances"), undefined);
  assert.equal(only(chances(6, 19), "missed-chances"), undefined);
});

test("13.9 example: 30 games 30 minutes apart alternating a loss at 95 and a win at 60", () => {
  const g = games(30, 5, () => ({ epLoss: 0.1 })).map((u, i) => ({
    ...u,
    game: { ...u.game, myResult: i % 2 ? ("win" as const) : ("loss" as const), playedAt: i * 30 * 60_000 },
    analysis: { ...u.analysis, summary: { ...u.analysis.summary, accuracy: { w: i % 2 ? 60 : 95, b: 80 } } },
  }));
  const r = only(g, "inconsistency")!;
  assert.equal(r.finding, "The accuracy of your games varies by 17.5 points from game to game (a typical range is 5 to 11, over 30 games).");
  assert.equal(
    r.action,
    "After a loss your next game averages 60.0% accuracy against 95.0% after a win (15 and 14 games). Play fewer games per session and stop after two losses in a row.",
  );
  assert.equal(r.severity, 60);
  assert.deepEqual(r.evidence.map((e) => e.gameId), ["g01", "g03", "g05", "g07", "g09"]); // the low-accuracy games after a loss
});
