import { test } from "node:test";
import assert from "node:assert/strict";
import { isSacrifice } from "../../../src/server/analysis/sacrifice.ts";

// docs/02-ANALYSIS-SPEC.md 18.4 "Sacrifice test (8.4), mover White".
test("queen lost for nothing: a sacrifice by (a)", () => {
  assert.equal(
    isSacrifice("4k3/8/4p3/8/8/8/8/3QK3 w - - 0 1", "d1d5", "w", ["e6d5", "e1e2"]),
    true,
  );
});

test("queen takes queen, recaptured: not a sacrifice (loss 9 is not more than the 9 taken)", () => {
  assert.equal(
    isSacrifice("4k3/8/4p3/3q4/8/8/8/3QK3 w - - 0 1", "d1d5", "w", ["e6d5", "e1e2"]),
    false,
  );
});

test("rook takes a defended pawn: a sacrifice by (a), loss 5 > 1 taken", () => {
  assert.equal(
    isSacrifice("4k3/8/4p3/3p4/8/8/8/3RK3 w - - 0 1", "d1d5", "w", ["e6d5", "e1e2"]),
    true,
  );
});

test("bishop takes a pawn defended by the king: a sacrifice by (a)", () => {
  assert.equal(
    isSacrifice("4k3/5p2/8/8/2B5/8/8/4K3 w - - 0 1", "c4f7", "w", ["e8f7", "e1e2"]),
    true,
  );
});

test("pawn en prise: not a sacrifice (pawns are not checked by (a); loss 1 < 2 for (b))", () => {
  assert.equal(
    isSacrifice("4k3/8/3p4/8/4P3/8/8/4K3 w - - 0 1", "e4e5", "w", ["d6e5", "e1e2"]),
    false,
  );
});

test("knight sac for 3-down after 2 plies: a sacrifice by (b); (a) says no", () => {
  assert.equal(
    isSacrifice("4r1k1/8/8/8/3P4/5N2/8/4K2Q w - - 0 1", "f3e5", "w", ["e8e5", "h1h7"]),
    true,
  );
});

test("same position, material regained: not a sacrifice", () => {
  assert.equal(
    isSacrifice("4r1k1/8/8/8/3P4/5N2/8/4K2Q w - - 0 1", "f3e5", "w", ["e8e5", "d4e5"]),
    false,
  );
});
