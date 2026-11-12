import { test } from "node:test";
import assert from "node:assert/strict";
import { openings } from "../../../src/server/insights/openings.ts";
import type { PersonalResult } from "../../../src/server/import/players.ts";
import { used } from "./fixtures.ts";

const close = (actual: number | undefined, expected: number) => assert.ok(Math.abs((actual ?? NaN) - expected) < 0.0005, `${actual} != ${expected}`);

/** A game of `plies` plies whose moves all have the given accuracy, White's Win% after ply 20 (or the last) = `win20`. */
function game(id: string, family: string | undefined, result: PersonalResult | undefined, accuracy: number, win20: number, plies = 24) {
  const moves = Array.from({ length: plies }, (_, i) => ({ accuracy, winPercentAfter: i === Math.min(20, plies) - 1 ? win20 : 50 }));
  return used(id, { moves, game: { openingFamily: family, myResult: result } });
}

test("7.1 example: three Sicilian games as White; a Sicilian win as Black", () => {
  const o = openings([
    game("a", "Sicilian Defense", "win", 100, 80),
    game("b", "Sicilian Defense", "loss", 50, 20),
    game("c", "Sicilian Defense", "draw", 95, 50),
    { ...game("d", "Sicilian Defense", "win", 90, 30), me: "b" as const },
  ]);
  const [white] = o.white;
  assert.equal(white.games.length, 3);
  assert.deepEqual([white.wins, white.draws, white.losses], [1, 1, 1]);
  assert.deepEqual(white.score, { value: 0.5, n: 3 });
  close(white.accuracy.value, 81.667);
  close(white.ep20.value, 0.5);
  close(o.black[0].ep20.value, 0.7);
});

test("7.1: score needs a result; a short game uses its last ply; only plies 1-20 count for accuracy", () => {
  const o = openings([game("a", "French Defense", undefined, 80, 60, 7), game("b", "French Defense", undefined, 80, 60)]);
  const [row] = o.white;
  assert.deepEqual(row.score, { value: undefined, n: 0 });
  close(row.ep20.value, 0.6);
  const mixed = used("c", {
    moves: Array.from({ length: 24 }, (_, i) => ({ accuracy: i < 20 ? 100 : 10, winPercentAfter: 50 })),
    game: { openingFamily: "X" },
  });
  close(openings([mixed]).white[0].accuracy.value, 100);
});

test("7.1: rows by games descending then family; games without a family are unnamed", () => {
  const o = openings([
    game("a", "B", "win", 80, 50),
    game("b", "A", "win", 80, 50),
    game("c", "C", "win", 80, 50),
    game("d", "C", "win", 80, 50),
    game("e", undefined, "win", 80, 50),
  ]);
  assert.deepEqual(o.white.map((r) => r.family), ["C", "A", "B"]);
  assert.equal(o.unnamed, 1);
  assert.deepEqual(o.black, []);
});

test("flags: Problem needs 8 games, score under 40% and EP @20 under 0.40 (0.41 silent); Strong needs score over 60%", () => {
  const rows = (results: PersonalResult[], win20: number) =>
    openings(results.map((r, i) => game(`g${i}`, "Fam", r, 80, win20))).white[0];
  const losing: PersonalResult[] = ["win", "win", "win", "loss", "loss", "loss", "loss", "loss"]; // 37.5%
  assert.equal(rows(losing, 39).flag, "problem");
  assert.equal(rows(losing, 41).flag, undefined);
  assert.equal(rows(losing.slice(1), 39).flag, undefined); // 7 games
  assert.equal(rows(["win", "win", "win", "win", "win", "loss", "loss", "loss"], 50).flag, "strong"); // 62.5%
  const sixty: PersonalResult[] = [...Array(6).fill("win"), ...Array(4).fill("loss")];
  assert.equal(rows(sixty, 50).flag, undefined); // exactly 60%
});
