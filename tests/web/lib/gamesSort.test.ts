import { test } from "node:test";
import assert from "node:assert/strict";
import { sortGames, FIRST_DIRECTION } from "../../../src/web/lib/gamesSort.ts";
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

test("FIRST_DIRECTION: descending for Date/Rating/Accuracy/Blunders, ascending for the rest", () => {
  assert.equal(FIRST_DIRECTION.date, "desc");
  assert.equal(FIRST_DIRECTION.rating, "desc");
  assert.equal(FIRST_DIRECTION.accuracy, "desc");
  assert.equal(FIRST_DIRECTION.blunders, "desc");
  for (const key of ["opponent", "colour", "result", "time", "opening", "status"] as const) {
    assert.equal(FIRST_DIRECTION[key], "asc");
  }
});

test("date: newest first by default (descending)", () => {
  const games = [game({ id: "old", playedAt: 1 }), game({ id: "new", playedAt: 2 })];
  assert.deepEqual(
    sortGames(games, "date", "desc").map((g) => g.id),
    ["new", "old"],
  );
});

test("opponent: case-insensitive alphabetical", () => {
  const games = [game({ id: "a", opponent: "Zed" }), game({ id: "b", opponent: "amy" })];
  assert.deepEqual(
    sortGames(games, "opponent", "asc").map((g) => g.id),
    ["b", "a"],
  );
});

test("colour: Black before White ascending", () => {
  const games = [game({ id: "w", myColour: "w" }), game({ id: "b", myColour: "b" })];
  assert.deepEqual(
    sortGames(games, "colour", "asc").map((g) => g.id),
    ["b", "w"],
  );
});

test("result: draw, loss, win alphabetical ascending", () => {
  const games = [game({ id: "win", myResult: "win" }), game({ id: "draw", myResult: "draw" }), game({ id: "loss", myResult: "loss" })];
  assert.deepEqual(
    sortGames(games, "result", "asc").map((g) => g.id),
    ["draw", "loss", "win"],
  );
});

test("time: blitz, bullet, classical, daily, rapid alphabetical ascending", () => {
  const classes = ["rapid", "daily", "classical", "bullet", "blitz"] as const;
  const games = classes.map((timeClass) => game({ id: timeClass, timeClass }));
  assert.deepEqual(
    sortGames(games, "time", "asc").map((g) => g.id),
    ["blitz", "bullet", "classical", "daily", "rapid"],
  );
});

test("status: done, error, none, queued, running alphabetical ascending", () => {
  const statuses = ["running", "queued", "none", "error", "done"] as const;
  const games = statuses.map((analysisStatus) => game({ id: analysisStatus, analysisStatus }));
  assert.deepEqual(
    sortGames(games, "status", "asc").map((g) => g.id),
    ["done", "error", "none", "queued", "running"],
  );
});

test("missing values always sort last, in both directions", () => {
  const games = [game({ id: "has", opponentRating: 1500 }), game({ id: "none", opponentRating: undefined })];
  assert.deepEqual(
    sortGames(games, "rating", "desc").map((g) => g.id),
    ["has", "none"],
  );
  assert.deepEqual(
    sortGames(games, "rating", "asc").map((g) => g.id),
    ["has", "none"],
  );
});

test("tie-break: newest played-at first, then id ascending, when the sort key is not date", () => {
  const games = [
    game({ id: "b", timeClass: "blitz", playedAt: 1 }),
    game({ id: "a", timeClass: "blitz", playedAt: 2 }),
    game({ id: "c", timeClass: "blitz", playedAt: 2 }),
  ];
  assert.deepEqual(
    sortGames(games, "time", "asc").map((g) => g.id),
    ["a", "c", "b"], // playedAt 2 before 1; among playedAt 2, id ascending (a before c)
  );
});

test("tie-break: id only, when the sort key is date itself", () => {
  const games = [game({ id: "b", playedAt: 1 }), game({ id: "a", playedAt: 1 })];
  assert.deepEqual(
    sortGames(games, "date", "desc").map((g) => g.id),
    ["a", "b"],
  );
});
