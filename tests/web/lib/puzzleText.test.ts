import { test } from "node:test";
import assert from "node:assert/strict";
import { relativeTime, scheduleNote, moveLabel, provenance } from "../../../src/web/lib/puzzleText.ts";

const NOW = Date.UTC(2026, 10, 10, 12);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

test("relativeTime: now, minutes (at least 1), hours (24 reads as a day), days rounded", () => {
  assert.equal(relativeTime(NOW, NOW), "now");
  assert.equal(relativeTime(NOW + 10_000, NOW), "in 1 minute");
  assert.equal(relativeTime(NOW + 20 * MIN, NOW), "in 20 minutes");
  assert.equal(relativeTime(NOW + HOUR, NOW), "in 1 hour");
  assert.equal(relativeTime(NOW + 5 * HOUR, NOW), "in 5 hours");
  assert.equal(relativeTime(NOW + 23.6 * HOUR, NOW), "in 1 day");
  assert.equal(relativeTime(NOW + DAY, NOW), "in 1 day");
  assert.equal(relativeTime(NOW + 2.2 * DAY, NOW), "in 2 days");
});

test("scheduleNote: retired, solved at a return, practised early, missed", () => {
  assert.equal(scheduleNote({ correct: true, retired: true, intervalDays: 0 }, NOW), "This puzzle is done and will not come back.");
  assert.equal(scheduleNote({ correct: false, retired: true, intervalDays: 0 }, NOW), "This puzzle is retired.");
  assert.equal(scheduleNote({ correct: true, retired: false, dueAt: NOW + 3 * DAY, intervalDays: 3 }, NOW), "Solved. Next review in 3 days.");
  assert.equal(scheduleNote({ correct: true, retired: false, dueAt: NOW + 2 * HOUR, intervalDays: 1 }, NOW), "Solved. Next review tomorrow.");
  assert.equal(scheduleNote({ correct: false, retired: false, dueAt: NOW + DAY, intervalDays: 1 }, NOW), "It will come back tomorrow (1 day).");
});

test("moveLabel and provenance: move number and dots from the position, optional parts left out", () => {
  const white = "8/8/8/8/8/8/8/8 w - - 0 23";
  const black = "8/8/8/8/8/8/8/8 b - - 0 23";
  assert.equal(moveLabel(white, "Nxe5", "blunder"), "23. Nxe5??");
  assert.equal(moveLabel(black, "Nxe5", "miss"), "23... Nxe5?");
  const item = { playedAt: Date.UTC(2024, 0, 31, 23), fen: white, playedSan: "Rxd5", playedClass: "mistake", phase: "middlegame" } as const;
  assert.equal(provenance({ ...item, opponent: "rival", tag: "positional" }), "vs rival · 31 Jan 2024 · your move 23. Rxd5? · Positional · Middlegame");
  assert.equal(provenance(item), "31 Jan 2024 · your move 23. Rxd5? · Middlegame");
});
