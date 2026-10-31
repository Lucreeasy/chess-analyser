import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { splitIntoGames } from "../../../src/server/import/pgnText.ts";
import { importGames } from "../../../src/server/import/report.ts";

const SAMPLES_DIR = fileURLToPath(new URL("../../../../reference/pgn-samples/", import.meta.url));
const NOW = Date.UTC(2026, 9, 31);

function textsOf(fileName: string): string[] {
  return splitIntoGames(readFileSync(SAMPLES_DIR + fileName, "utf8"));
}

// docs/03-IMPORT-SPEC.md section 8, acceptance scenarios 2 and 3.
test("duplicates.pgn: 3 new, 2 duplicates into an empty library", () => {
  const { summary } = importGames(textsOf("duplicates.pgn"), "file", ["bc_tester"], NOW, new Set());
  assert.equal(summary.total, 5);
  assert.equal(summary.added, 3);
  assert.equal(summary.duplicates, 2);
  assert.equal(summary.failed.length, 0);
  assert.equal(summary.gameIds.length, 3);
});

test("importing the same file twice: second run adds 0, duplicates = first run's new + duplicates", () => {
  const texts = textsOf("duplicates.pgn");
  const first = importGames(texts, "file", ["bc_tester"], NOW, new Set());
  const alreadyStored = new Set(first.newGames.map((g) => g.id));

  const second = importGames(texts, "file", ["bc_tester"], NOW, alreadyStored);
  assert.equal(second.summary.added, 0);
  assert.deepEqual(second.summary.gameIds, []);
  assert.equal(second.summary.duplicates, first.summary.added + first.summary.duplicates);
  assert.equal(second.summary.failed.length, first.summary.failed.length);
});

test("malformed.pgn: one failure at index 1, reason mentions Qxh7, snippet contains broken_bruno", () => {
  const { summary } = importGames(textsOf("malformed.pgn"), "file", ["bc_tester"], NOW, new Set());
  assert.equal(summary.failed.length, 1);
  assert.equal(summary.failed[0].index, 1);
  assert.match(summary.failed[0].reason, /Qxh7/);
  assert.match(summary.failed[0].snippet, /broken_bruno/);
  assert.equal(summary.added, 2); // the two neighbouring games are stored
});

test("an empty text is a report of all zeros with no failures", () => {
  const { summary, newGames } = importGames([], "file", ["bc_tester"], NOW, new Set());
  assert.deepEqual(summary, { total: 0, added: 0, duplicates: 0, failed: [], gameIds: [] });
  assert.deepEqual(newGames, []);
});

test("a doubled multi-timecontrols.pgn: 8 new, 8 duplicates; a third paste adds 0", () => {
  const once = textsOf("multi-timecontrols.pgn");
  const doubled = [...once, ...once];
  const { summary, newGames } = importGames(doubled, "file", ["bc_tester"], NOW, new Set());
  assert.equal(summary.added, 8);
  assert.equal(summary.duplicates, 8);

  const third = importGames(once, "file", ["bc_tester"], NOW, new Set(newGames.map((g) => g.id)));
  assert.equal(third.summary.added, 0);
  assert.equal(third.summary.duplicates, 8);
});

// docs/03-IMPORT-SPEC.md section 3.7: filtered-out games are neither counted nor reported.
test("timeClasses filter: only games of the wanted classes are counted and added", () => {
  const texts = textsOf("multi-timecontrols.pgn"); // blitz, bullet, blitz, rapid, rapid, bullet, blitz, rapid
  const { summary } = importGames(texts, "chesscom_api", ["bc_tester"], NOW, new Set(), new Set(["blitz"]));
  assert.equal(summary.total, 3);
  assert.equal(summary.added, 3);
  assert.equal(summary.duplicates, 0);
  assert.equal(summary.failed.length, 0);
});

test("timeClasses filter: a failing game of an unwanted class is skipped silently, not a failure", () => {
  const texts = textsOf("malformed.pgn"); // the failing middle game is blitz (TimeControl 180+2)
  const { summary } = importGames(texts, "file", ["bc_tester"], NOW, new Set(), new Set(["rapid"]));
  assert.equal(summary.total, 0);
  assert.equal(summary.failed.length, 0);
});

test("timeClasses filter: with all five classes selected, nothing is filtered out", () => {
  const texts = textsOf("multi-timecontrols.pgn");
  const all = new Set<"bullet" | "blitz" | "rapid" | "daily" | "classical">(["bullet", "blitz", "rapid", "daily", "classical"]);
  const { summary } = importGames(texts, "chesscom_api", ["bc_tester"], NOW, new Set(), all);
  assert.equal(summary.total, 8);
  assert.equal(summary.added, 8);
});
