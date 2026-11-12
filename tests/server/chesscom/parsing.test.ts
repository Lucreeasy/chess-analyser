import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isValidUsername,
  isValidMonth,
  parseRetryAfter,
  looksLikePgn,
  stripBom,
  parseArchiveList,
} from "../../../src/server/chesscom/parsing.ts";

test("isValidUsername: 3-25 letters, digits, _ or -", () => {
  assert.equal(isValidUsername("bc_tester"), true);
  assert.equal(isValidUsername("ab"), false); // too short
  assert.equal(isValidUsername("a".repeat(26)), false); // too long
  assert.equal(isValidUsername("bad name"), false); // space
  assert.equal(isValidUsername("  bc_tester  "), true); // trimmed first
});

test("isValidMonth: YYYY-MM with month 01-12", () => {
  assert.equal(isValidMonth("2026-09"), true);
  assert.equal(isValidMonth("2026-00"), false);
  assert.equal(isValidMonth("2026-13"), false);
  assert.equal(isValidMonth("2026-9"), false);
  assert.equal(isValidMonth("not-a-month"), false);
});

// A Retry-After as a plain number of seconds and as an HTTP date.
test("parseRetryAfter: a plain number of seconds", () => {
  assert.equal(parseRetryAfter("7"), 7);
  assert.equal(parseRetryAfter("3600"), 3600);
  assert.equal(parseRetryAfter(null), undefined);
  assert.equal(parseRetryAfter("not-a-number-or-date"), undefined);
});

test("parseRetryAfter: an HTTP date, understood relative to now", () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  const tenSecondsLater = new Date(now + 10_000).toUTCString();
  assert.equal(parseRetryAfter(tenSecondsLater, now), 10);
});

test("looksLikePgn: at least one of the three tags", () => {
  assert.equal(looksLikePgn('[Event "Live Chess"]\n1. e4'), true);
  assert.equal(looksLikePgn('[White "a"]'), true);
  assert.equal(looksLikePgn("<html>blocked</html>"), false);
  assert.equal(looksLikePgn(""), false);
});

test("stripBom", () => {
  assert.equal(stripBom("﻿hello"), "hello");
  assert.equal(stripBom("hello"), "hello");
});

test("parseArchiveList: extracts, dedupes and sorts YYYY-MM", () => {
  const body = JSON.stringify({
    archives: [
      "https://api.chess.com/pub/player/bc_tester/games/2026/03",
      "https://api.chess.com/pub/player/bc_tester/games/2026/01",
      "https://api.chess.com/pub/player/bc_tester/games/2026/03", // repeat
      "not a month url at all",
    ],
  });
  assert.deepEqual(parseArchiveList(body), ["2026-01", "2026-03"]);
});

test("parseArchiveList: a player with no games gives an empty list, not an error", () => {
  assert.deepEqual(parseArchiveList(JSON.stringify({ archives: [] })), []);
});

test("parseArchiveList: invalid JSON or no archives list is undefined (an error upstream)", () => {
  assert.equal(parseArchiveList("not json"), undefined);
  assert.equal(parseArchiveList(JSON.stringify({ other: [] })), undefined);
});
