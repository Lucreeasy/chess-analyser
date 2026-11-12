import { test } from "node:test";
import assert from "node:assert/strict";
import { listView, parseListQuery } from "../../../src/server/puzzles/list.ts";
import type { Puzzle } from "../../../src/server/puzzles/store.ts";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 10, 12);

function puzzle(id: string, fields: Partial<Puzzle> = {}): Puzzle {
  return {
    id,
    gameId: `game-${id}`,
    ply: 1,
    fen: "8/8/8/8/8/8/8/8 w - - 0 1",
    solution: ["e2e4"],
    phase: "middlegame",
    bestEp: 0.6,
    bestLine: ["e2e4"],
    playedSan: "a3",
    playedUci: "a2a3",
    playedClass: "blunder",
    epLoss: 0.3,
    dueAt: NOW - 1,
    intervalDays: 0,
    attempts: 0,
    createdAt: NOW - DAY,
    playedAt: NOW - DAY,
    ...fields,
  };
}

const all = { mode: "all", limit: 50 } as const;
const due = { mode: "due", limit: 50 } as const;
const ids = (v: ReturnType<typeof listView>) => v.items.map((i) => i.id);

test("the four groups: reviews due (oldest due first), new (newest game first), waiting (soonest first), retired", () => {
  const puzzles = [
    puzzle("retired", { attempts: 1, dueAt: undefined, lastResult: "solved" }),
    puzzle("waitingLate", { attempts: 1, dueAt: NOW + 3 * DAY, intervalDays: 3 }),
    puzzle("waitingSoon", { attempts: 1, dueAt: NOW + DAY, intervalDays: 1 }),
    puzzle("newOld", { playedAt: NOW - 5 * DAY }),
    puzzle("newRecentPly9", { playedAt: NOW - DAY, ply: 9 }),
    puzzle("newRecentPly3", { playedAt: NOW - DAY, ply: 3 }),
    puzzle("reviewRecent", { attempts: 1, dueAt: NOW - DAY, intervalDays: 1 }),
    puzzle("reviewOld", { attempts: 2, dueAt: NOW - 2 * DAY, intervalDays: 3 }),
  ];
  assert.deepEqual(ids(listView(puzzles, all, NOW)), [
    "reviewOld", "reviewRecent", "newRecentPly3", "newRecentPly9", "newOld", "waitingSoon", "waitingLate", "retired",
  ]);
  assert.deepEqual(ids(listView(puzzles, due, NOW)), ["reviewOld", "reviewRecent", "newRecentPly3", "newRecentPly9", "newOld"]);
});

test("order check: a missed puzzle waits before a retired one; once due, it comes before a new puzzle", () => {
  const missed = puzzle("missed", { attempts: 1, dueAt: NOW + DAY, intervalDays: 1, lastResult: "missed" });
  const retired = puzzle("retired", { attempts: 1, dueAt: undefined, lastResult: "solved" });
  assert.deepEqual(ids(listView([retired, missed], all, NOW)), ["missed", "retired"]);
  assert.deepEqual(ids(listView([retired, missed], due, NOW)), []);
  const later = NOW + DAY;
  assert.deepEqual(ids(listView([retired, missed, puzzle("new")], due, later)), ["missed", "new"]);
});

test("items never carry the solution, and counts follow the filters but not the mode", () => {
  const puzzles = [
    puzzle("a", { tag: "hung_piece" }),
    puzzle("b", { tag: "hung_piece", attempts: 1, dueAt: undefined, lastResult: "solved" }),
    puzzle("c", { tag: "missed_tactic", phase: "endgame", attempts: 1, dueAt: NOW + 2 * DAY, lastResult: "missed" }),
    puzzle("d", { phase: "opening" }),
  ];
  const v = listView(puzzles, { mode: "due", tag: "hung_piece", limit: 50 }, NOW);
  assert.deepEqual(ids(v), ["a"]);
  assert.equal("solution" in v.items[0] || "bestLine" in v.items[0] || "bestEp" in v.items[0], false);
  assert.deepEqual(v.counts, { total: 2, due: 1, solved: 1, retired: 1 });
  assert.equal(v.nextDue, undefined);
  assert.equal(listView(puzzles, { ...all, tag: "missed_tactic" }, NOW).nextDue, NOW + 2 * DAY);
});

test("facets over all puzzles: tags by count then key ('none' included), phases in game order, with due counts", () => {
  const puzzles = [
    puzzle("a", { tag: "positional" }),
    puzzle("b", { tag: "hung_piece", phase: "endgame" }),
    puzzle("c", { tag: "hung_piece", phase: "opening", attempts: 1, dueAt: undefined }),
    puzzle("d", { tag: undefined }),
  ];
  const v = listView(puzzles, { mode: "due", phase: "endgame", limit: 0 }, NOW);
  assert.deepEqual(v.items, []);
  assert.deepEqual(v.tagFacets, [
    { key: "hung_piece", count: 2, due: 1 },
    { key: "none", count: 1, due: 1 },
    { key: "positional", count: 1, due: 1 },
  ]);
  assert.deepEqual(v.phaseFacets.map((f) => f.key), ["opening", "middlegame", "endgame"]);
});

test("parseListQuery: defaults, the 200 cap, and clear errors for invalid values", () => {
  assert.deepEqual(parseListQuery(new URLSearchParams("")), { mode: "due", tag: undefined, phase: undefined, limit: 50 });
  assert.deepEqual(parseListQuery(new URLSearchParams("mode=all&tag=none&phase=endgame&limit=500")), {
    mode: "all", tag: "none", phase: "endgame", limit: 200,
  });
  assert.equal(typeof parseListQuery(new URLSearchParams("mode=later")), "string");
  assert.equal(typeof parseListQuery(new URLSearchParams("tag=pin")), "string");
  assert.equal(typeof parseListQuery(new URLSearchParams("phase=late")), "string");
  assert.equal(typeof parseListQuery(new URLSearchParams("limit=-1")), "string");
  assert.equal(typeof parseListQuery(new URLSearchParams("limit=2.5")), "string");
});
