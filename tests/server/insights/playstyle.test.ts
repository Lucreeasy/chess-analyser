import { test } from "node:test";
import assert from "node:assert/strict";
import { percentile, ordinal, playstyle, type PlaystyleInputs } from "../../../src/server/insights/playstyle.ts";

test("12.1 examples: band 10, 20, 30, 40, 50 and the flat band 0, 0, 5, 10, 15", () => {
  const band = [10, 20, 30, 40, 50];
  assert.deepEqual([15, 35, 5, 55, 0, 60].map((x) => percentile(x, band)), [17.5, 62.5, 2.5, 97.5, 0, 100]);
  const flat = [0, 0, 5, 10, 15];
  assert.deepEqual([0, -0.1, 2.5].map((x) => percentile(x, flat)), [25, 0, 37.5]);
  assert.equal(percentile(15, band, true), 82.5);
  assert.equal(percentile(50, band), 90);
});

test("12.4: ordinals", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st"]);
});

const stat = (value: number) => ({ value, n: 10 });
const EXAMPLE: PlaystyleInputs = {
  checksCaptures: stat(0.27),
  opponentHalf: stat(0.43),
  pawnStorm: stat(0.05),
  oppositeCastling: stat(0.1),
  volatility: stat(9.5),
  accuracy: stat(78),
  bestMoveRate: stat(0.42),
  conversion: stat(0.72),
  endgameAccuracy: stat(62),
  gamesInTrouble: stat(0.4),
  troubleBlunders: stat(6),
};

test("12.5 worked example: axis values, input percentiles and two explanations", () => {
  const { axes } = playstyle(EXAMPLE);
  assert.deepEqual(axes.map((a) => a.value), [56.5, 62.5, 62.7, 46.3, 39.6]);
  assert.deepEqual(axes[0].inputs.map((i) => i.percentile), [58.3, 62.5, 62.5, 42.9]);
  assert.deepEqual(axes[4].inputs.map((i) => i.percentile), [37.5, 41.7]);
  assert.equal(
    axes[2].explanation,
    "You find accurate moves, and often the engine move. Based on overall accuracy 78.0 (higher than 64th percentile of club players); best-move rate 42% (higher than 61st percentile of club players).",
  );
  assert.equal(
    axes[4].explanation,
    "You often run low on time, and blunders pile up when you do. Based on games that enter time trouble 40% (better than 38th percentile of club players); blunders per 100 moves in time trouble 6.0 per 100 moves (better than 42nd percentile of club players).",
  );
});

test("12.5 worked example: archetype Sharp calculator, weakest Clock discipline", () => {
  assert.deepEqual(playstyle(EXAMPLE).archetype, {
    label: "Sharp calculator",
    description: "You thrive in volatile positions and calculate them accurately.",
    weakest: "clock",
    pair: ["precision", "sharpness"],
  });
});

test("12.3/12.6: inputs without data are dropped; an axis without data has none; fewer than 2 axes -> no archetype", () => {
  const none = { value: undefined, n: 0 };
  const noClock = { ...EXAMPLE, gamesInTrouble: none, troubleBlunders: none };
  const { axes } = playstyle(noClock);
  assert.equal(axes[4].value, undefined);
  assert.equal(axes[4].explanation, "Clock discipline: not enough data yet.");
  const onlyOne = Object.fromEntries(Object.keys(EXAMPLE).map((k) => [k, none])) as unknown as PlaystyleInputs;
  assert.equal(playstyle({ ...onlyOne, volatility: stat(9.5) }).archetype, undefined);
});

test("12.6: a spread under 15 is balanced; exactly 15 is not", () => {
  const two = (a: number, b: number) => {
    const none = { value: undefined, n: 0 };
    const base = Object.fromEntries(Object.keys(EXAMPLE).map((k) => [k, none])) as unknown as PlaystyleInputs;
    return playstyle({ ...base, volatility: stat(a), accuracy: stat(b) }).archetype;
  };
  // volatility 8 -> 50; accuracy 74 -> 50 (spread 0) -> balanced, weakest the later axis (Precision)
  assert.deepEqual(two(8, 74), { label: "Balanced all-rounder", description: "No single strength stands out: your five axes are close together.", weakest: "precision" });
  // volatility 11 -> 75; accuracy 66 -> 25 -> spread 50
  assert.equal(two(11, 66)?.label, "Sharp calculator");
});
