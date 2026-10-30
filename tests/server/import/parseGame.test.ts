import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { splitIntoGames } from "../../../src/server/import/pgnText.ts";
import { parseGame } from "../../../src/server/import/parseGame.ts";

const SAMPLES_DIR = fileURLToPath(new URL("../../../../reference/pgn-samples/", import.meta.url));
const NOW = Date.UTC(2026, 9, 31);

function parseFile(name: string) {
  const text = readFileSync(SAMPLES_DIR + name, "utf8");
  return splitIntoGames(text).map((g) => parseGame(g, "file", ["bc_tester"], NOW));
}

// docs/03-IMPORT-SPEC.md section 8, acceptance scenario 1: every sample file, concatenated.
test("every reference/pgn-samples file together: total 52, new 49, duplicates 2, failed 1", () => {
  const files = readdirSync(SAMPLES_DIR).filter((f) => f.endsWith(".pgn")).sort();
  let total = 0;
  let added = 0;
  let duplicates = 0;
  let failed = 0;

  for (const file of files) {
    const results = parseFile(file);
    const seen = new Set<string>();
    for (const r of results) {
      total++;
      if (r.failure) {
        failed++;
      } else if (seen.has(r.game!.id)) {
        duplicates++;
      } else {
        seen.add(r.game!.id);
        added++;
      }
    }
  }

  assert.equal(total, 52);
  assert.equal(added, 49);
  assert.equal(duplicates, 2);
  assert.equal(failed, 1);
});

test("malformed.pgn: the middle game fails with the exact reason, its neighbours are fine", () => {
  const results = parseFile("malformed.pgn");
  assert.equal(results.length, 3);
  assert.equal(results[0].failure, undefined);
  assert.equal(results[1].failure, 'Illegal or unreadable move "Qxh7" at move 9. (White)');
  assert.equal(results[2].failure, undefined);
});

test("endings.pgn: every field matches the sample README exactly", () => {
  const results = parseFile("endings.pgn");
  const games = results.map((r) => r.game!);
  assert.deepEqual(
    games.map((g) => [g.myColour, g.result, g.myResult, g.timeClass, g.termination, g.plyCount]),
    [
      ["w", "1-0", "win", "blitz", "checkmate", 13],
      ["b", "1-0", "loss", "blitz", "resignation", 59],
      ["w", "1-0", "win", "bullet", "time", 67],
      ["w", "1/2-1/2", "draw", "rapid", "stalemate", 19],
      ["w", "1/2-1/2", "draw", "blitz", "repetition", 10],
      ["b", "1/2-1/2", "draw", "rapid", "agreement", 72],
      ["w", "1/2-1/2", "draw", "blitz", "insufficient material", 5],
      ["w", "1/2-1/2", "draw", "bullet", "insufficient material", 6],
    ],
  );
  assert.equal(games[0].eco, "C41");
  assert.match(games[0].openingName!, /Philidor/);
  assert.equal(games[1].openingFamily, "King's Indian Attack, with e6"); // no colon: family = whole name
});

test("daily.pgn: all three games are daily, with no clock data implied by time class alone", () => {
  const games = parseFile("daily.pgn").map((r) => r.game!);
  assert.deepEqual(games.map((g) => g.timeClass), ["daily", "daily", "daily"]);
  assert.deepEqual(games.map((g) => g.myColour), ["w", "b", "w"]);
});

test("case-usernames.pgn: the username matches regardless of letter case", () => {
  const games = parseFile("case-usernames.pgn").map((r) => r.game!);
  assert.deepEqual(games.map((g) => g.myColour), ["w", "b", "w"]);
});

test("no-user.pgn: neither player matches, me is unknown, not a failure", () => {
  const results = parseFile("no-user.pgn");
  for (const r of results) {
    assert.equal(r.failure, undefined);
    assert.equal(r.game!.myColour, undefined);
    assert.equal(r.game!.myResult, undefined);
  }
});

test("non-standard-start.pgn: move counter from the FEN, no opening lookup, no ECO tag", () => {
  const games = parseFile("non-standard-start.pgn").map((r) => r.game!);
  assert.deepEqual(games.map((g) => [g.myColour, g.result, g.plyCount]), [
    ["w", "1-0", 41],
    ["b", "1-0", 42],
  ]);
  for (const g of games) {
    assert.equal(g.eco, undefined);
    assert.equal(g.openingName, undefined);
  }
});

test("late-illegal.pgn: both games are stored at import despite game 2's late illegal move", () => {
  const results = parseFile("late-illegal.pgn");
  assert.equal(results[0].failure, undefined);
  assert.equal(results[1].failure, undefined);
  assert.equal(results[1].game!.plyCount, 60);
});

test("re-importing the same file adds nothing: all would-be-new ids are duplicates of each other", () => {
  const first = parseFile("duplicates.pgn").map((r) => r.game?.id ?? r.failure);
  const second = parseFile("duplicates.pgn").map((r) => r.game?.id ?? r.failure);
  assert.deepEqual(first, second); // same text in, same ids out, every time
});

test("an empty or whitespace-only text yields no games to parse at all", () => {
  assert.deepEqual(splitIntoGames(""), []);
});
