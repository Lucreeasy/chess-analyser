import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePlayedAt } from "../../../src/server/import/dateTime.ts";
import {
  playerName,
  resolveMyColour,
  resolveResult,
  resolvePersonalResult,
  resolveRating,
} from "../../../src/server/import/players.ts";
import { classifyTimeControl, timeControlText } from "../../../src/server/import/timeClass.ts";
import { normalizeTermination } from "../../../src/server/import/termination.ts";

const IMPORT_MOMENT = 1_700_000_000_000;

test("playedAt: UTCDate+UTCTime wins over Date+Time", () => {
  const tags = new Map([
    ["UTCDate", "2026.10.12"],
    ["UTCTime", "17:30:12"],
    ["Date", "2020.01.01"],
    ["Time", "00:00:00"],
  ]);
  assert.equal(resolvePlayedAt(tags, IMPORT_MOMENT), Date.UTC(2026, 9, 12, 17, 30, 12));
});

test("playedAt: a usable UTCDate with an unusable UTCTime gives midnight UTC", () => {
  const tags = new Map([["UTCDate", "2026.10.12"], ["UTCTime", "??:??:??"]]);
  assert.equal(resolvePlayedAt(tags, IMPORT_MOMENT), Date.UTC(2026, 9, 12, 0, 0, 0));
});

test("playedAt: falls through an unusable UTCDate to Date+Time", () => {
  const tags = new Map([["UTCDate", "????.??.??"], ["Date", "2025-12-31"], ["Time", "9:05"]]);
  assert.equal(resolvePlayedAt(tags, IMPORT_MOMENT), Date.UTC(2025, 11, 31, 9, 5, 0));
});

test("playedAt: an impossible date (30 Feb) is not usable", () => {
  const tags = new Map([["UTCDate", "2025.02.30"]]);
  assert.equal(resolvePlayedAt(tags, IMPORT_MOMENT), IMPORT_MOMENT);
});

test("playedAt: no usable date at all falls back to the import moment", () => {
  assert.equal(resolvePlayedAt(new Map(), IMPORT_MOMENT), IMPORT_MOMENT);
});

test("playerName: trimmed, or '?' when missing/empty", () => {
  assert.equal(playerName("  alice  "), "alice");
  assert.equal(playerName(""), "?");
  assert.equal(playerName(undefined), "?");
});

test("resolveMyColour: White checked first, case-insensitive, whole-name match", () => {
  assert.equal(resolveMyColour("BC_Tester", "someone", ["bc_tester"]), "w");
  assert.equal(resolveMyColour("someone", "BC_Tester", ["bc_tester"]), "b");
  assert.equal(resolveMyColour("bc_testers", "someone", ["bc_tester"]), undefined); // no partial match
  assert.equal(resolveMyColour("a", "b", []), undefined);
  assert.equal(resolveMyColour("x", "x", ["x"]), "w"); // a game against yourself counts as White
});

test("resolveResult: the four result-table rows", () => {
  assert.equal(resolveResult("1-0", "0-1"), "1-0"); // a valid, non-* tag wins regardless of the token
  assert.equal(resolveResult("*", "0-1"), "0-1"); // * tag, finished movetext
  assert.equal(resolveResult("*", undefined), "*");
  assert.equal(resolveResult("?", "1/2-1/2"), "1/2-1/2"); // junk tag, a token
  assert.equal(resolveResult("?", undefined), "*"); // junk tag, no token
  assert.equal(resolveResult(undefined, undefined), "*");
});

test("resolvePersonalResult: only when my colour is known and the game finished", () => {
  assert.equal(resolvePersonalResult("1-0", "w"), "win");
  assert.equal(resolvePersonalResult("1-0", "b"), "loss");
  assert.equal(resolvePersonalResult("1/2-1/2", "w"), "draw");
  assert.equal(resolvePersonalResult("1-0", undefined), undefined);
  assert.equal(resolvePersonalResult("*", "w"), undefined);
});

test("resolveRating: digits only", () => {
  assert.equal(resolveRating("1500"), 1500);
  assert.equal(resolveRating("?"), undefined);
  assert.equal(resolveRating(""), undefined);
  assert.equal(resolveRating("1500.5"), undefined);
  assert.equal(resolveRating(undefined), undefined);
});

// Examples.
test("classifyTimeControl: the exact example table", () => {
  const cases: Array<[string, string]> = [
    ["60", "bullet"], ["60+1", "bullet"], ["120+1", "bullet"],
    ["180", "blitz"], ["180+2", "blitz"], ["300+5", "blitz"],
    ["600", "rapid"], ["900+10", "rapid"], ["1800", "rapid"],
    ["3600", "classical"], ["5400+30", "classical"],
    ["1/86400", "daily"], ["40/7200:900", "daily"],
    ["-", "classical"], ["", "classical"], ["?", "classical"], ["abc", "classical"], ["3+", "classical"],
  ];
  for (const [input, expected] of cases) assert.equal(classifyTimeControl(input), expected, input);
});

test("timeControlText: trimmed, or '-' when missing/empty", () => {
  assert.equal(timeControlText("  300  "), "300");
  assert.equal(timeControlText(""), "-");
  assert.equal(timeControlText(undefined), "-");
});

// Examples.
test("normalizeTermination: the exact examples", () => {
  const cases: Array<[string, string]> = [
    ["luca won by resignation", "resignation"],
    ["bc_tester won on time", "time"],
    ["Game drawn by agreement", "agreement"],
    ["Game drawn by the 50-move rule", "50-move rule"],
    ["luca won - game abandoned", "abandoned"],
    ["Time forfeit", "time"],
    ["Something unexpected", "Something unexpected"],
    ["  padded text  ", "padded text"],
  ];
  for (const [input, expected] of cases) assert.equal(normalizeTermination(input), expected, input);
});

test("normalizeTermination: a username containing 'resign' does not confuse the match", () => {
  assert.equal(normalizeTermination("resignation_king won by stalemate"), "stalemate");
});

test("normalizeTermination: no tag falls back to the final position", () => {
  const checkmateFen = "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4";
  assert.equal(normalizeTermination(undefined, checkmateFen), "checkmate");
  const stalemateFen = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1";
  assert.equal(normalizeTermination(undefined, stalemateFen), "stalemate");
  assert.equal(normalizeTermination(undefined, undefined), undefined);
  const ongoingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  assert.equal(normalizeTermination(undefined, ongoingFen), undefined);
});
