import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { classifyOpening } from "../../../src/server/import/opening.ts";
import { replayGame } from "../../../src/server/import/replay.ts";

function fensOf(sanMoves: string[]): string[] {
  const { fens } = replayGame(new Chess().fen(), sanMoves.map((raw) => ({ raw })), true);
  return fens;
}

// Examples.
test("the Najdorf: ECO B90, matched at the deepest named position (ply 10)", () => {
  const fens = fensOf(["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"]);
  const opening = classifyOpening(fens, true, undefined);
  assert.equal(opening.eco, "B90");
  assert.match(opening.openingName!, /Najdorf/);
  assert.equal(opening.openingFamily, "Sicilian Defense");
});

test("transposition: two move orders into the same position give the same name", () => {
  const viaD4 = fensOf(["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"]);
  const viaC4 = fensOf(["c4", "e6", "Nc3", "Nf6", "d4", "Bb4"]);
  const a = classifyOpening(viaD4, true, undefined);
  const b = classifyOpening(viaC4, true, undefined);
  assert.equal(a.openingName, b.openingName);
  assert.match(a.openingName!, /Nimzo-Indian/);
});

test("no hit: the ECO tag is kept if present, name/family stay absent", () => {
  const fens = ["4k3/8/8/8/8/8/8/4K3 w - - 0 1"]; // certainly not a key in the 3865-entry book
  assert.deepEqual(classifyOpening(fens, true, "A00"), { eco: "A00" });
  assert.deepEqual(classifyOpening(fens, true, undefined), {});
});

test("a non-standard start keeps only the ECO tag, never looks up the book", () => {
  const fens = fensOf(["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"]); // would match Najdorf
  assert.deepEqual(classifyOpening(fens, false, "X99"), { eco: "X99" });
  assert.deepEqual(classifyOpening(fens, false, undefined), {});
});

test("no moves: unnamed", () => {
  assert.deepEqual(classifyOpening([], true, undefined), {});
});
