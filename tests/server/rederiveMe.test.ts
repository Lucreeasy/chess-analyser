import { test } from "node:test";
import assert from "node:assert/strict";
import { rederiveMe } from "../../src/server/rederiveMe.ts";
import type { StoredGame } from "../../src/server/import/parseGame.ts";

function game(overrides: Partial<StoredGame>): StoredGame {
  return {
    id: "a",
    source: "file",
    pgn: "1. e4",
    tags: {},
    white: "alice",
    black: "bob",
    result: "1-0",
    timeControlText: "-",
    timeClass: "classical",
    playedAt: 1,
    plyCount: 1,
    importedAt: 1,
    analysisStatus: "none",
    ...overrides,
  };
}

test("picks up a newly-added username: colour and personal result appear", () => {
  const [updated] = rederiveMe([game({ white: "alice", black: "bob", result: "1-0" })], ["bob"]);
  assert.equal(updated.myColour, "b");
  assert.equal(updated.myResult, "loss");
});

test("a removed username: colour and personal result go back to undefined", () => {
  const [updated] = rederiveMe([game({ white: "alice", black: "bob", myColour: "w", myResult: "win" })], ["someone_else"]);
  assert.equal(updated.myColour, undefined);
  assert.equal(updated.myResult, undefined);
});

test("every other field is left untouched", () => {
  const original = game({ eco: "B90", openingName: "Najdorf" });
  const [updated] = rederiveMe([original], ["alice"]);
  assert.equal(updated.eco, "B90");
  assert.equal(updated.openingName, "Najdorf");
  assert.equal(updated.pgn, original.pgn);
});
