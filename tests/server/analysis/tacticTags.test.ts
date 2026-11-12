import { test } from "node:test";
import assert from "node:assert/strict";
import { tacticTag, type EngineLineWithPv } from "../../../src/server/analysis/tacticTags.ts";

function line(cp: number, pv: string[]): EngineLineWithPv {
  return { cp, pv };
}
function mateLine(mate: number, pv: string[]): EngineLineWithPv {
  return { mate, pv };
}

// "Tag rule boundaries", White to move throughout.
test("T1: allowed_mate, checked before missed_mate", () => {
  const tag = tacticTag({
    mover: "w",
    fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    playedUci: "f2f3",
    fenAfter: "rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1",
    best: mateLine(2, ["e2e4"]),
    after: mateLine(-1, ["e7e5"]),
  });
  assert.equal(tag, "allowed_mate");
});

test("T2: missed_mate", () => {
  const tag = tacticTag({
    mover: "w",
    fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    playedUci: "e2e4",
    fenAfter: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    best: mateLine(4, ["d2d4"]),
    after: line(300, ["e7e5"]),
  });
  assert.equal(tag, "missed_mate");
});

test("T3: positional - SEE says a rook for a knight does not pay", () => {
  const tag = tacticTag({
    mover: "w",
    fenBefore: "4k3/8/8/8/r7/2N5/2B5/4K3 w - - 0 1",
    playedUci: "c3e4",
    fenAfter: "4k3/8/8/8/r7/8/2B5/4K3 b - - 0 1",
    best: line(0, ["e1d2"]),
    after: line(0, ["a4e4", "c2e4"]),
  });
  assert.equal(tag, "positional");
});

test("T4: positional - a trade (our move took a knight)", () => {
  const tag = tacticTag({
    mover: "w",
    fenBefore: "4k3/8/4p3/3n4/8/2N5/8/4K3 w - - 0 1",
    playedUci: "c3d5",
    fenAfter: "4k3/8/4p3/3N4/8/8/8/4K3 b - - 0 1",
    best: line(0, ["e1d2"]),
    after: line(0, ["e6d5", "e1d2"]),
  });
  assert.equal(tag, "positional");
});

test("T5: positional - a pawn is not a hung piece", () => {
  const tag = tacticTag({
    mover: "w",
    fenBefore: "4k3/8/5n2/8/8/8/4P3/4K3 w - - 0 1",
    playedUci: "e2e4",
    fenAfter: "4k3/8/5n2/8/4P3/8/8/4K3 b - - 0 1",
    best: line(-200, ["e1d2"]),
    after: line(-300, ["f6e4", "e1d1"]),
  });
  assert.equal(tag, "positional");
});

test("T6: positional - odd line trimmed to 2 plies, the rook is not yet taken", () => {
  const tag = tacticTag({
    mover: "w",
    fenBefore: "4k3/8/8/4n3/8/8/P2R4/6K1 w - - 0 1",
    playedUci: "a2a3",
    fenAfter: "4k3/8/8/4n3/8/P7/3R4/6K1 b - - 0 1",
    best: line(300, ["d2d3"]),
    after: line(0, ["e5f3", "g1f1", "f3d2"]),
  });
  assert.equal(tag, "positional");
});

test("T7: allowed_tactic, checked before missed_tactic", () => {
  const tag = tacticTag({
    mover: "w",
    fenBefore: "4k3/8/3b4/4n3/8/8/P2R4/6K1 w - - 0 1",
    playedUci: "a2a3",
    fenAfter: "4k3/8/3b4/4n3/8/P7/3R4/6K1 b - - 0 1",
    best: line(300, ["d2d6", "e8e7"]),
    after: line(-200, ["e5f3", "g1f1", "f3d2", "f1e1"]),
  });
  assert.equal(tag, "allowed_tactic");
});

test("T8: missed_tactic, a 1-ply line is kept", () => {
  const tag = tacticTag({
    mover: "w",
    fenBefore: "4k3/8/8/3n4/8/8/3R4/4K3 w - - 0 1",
    playedUci: "e1f1",
    fenAfter: "4k3/8/8/3n4/8/8/3R4/5K2 b - - 0 1",
    best: line(500, ["d2d5"]),
    after: line(300, ["d5f6", "f1e2"]),
  });
  assert.equal(tag, "missed_tactic");
});

test("T9: positional - trimmed to 2 plies, the capture is cut", () => {
  const tag = tacticTag({
    mover: "w",
    fenBefore: "4k3/8/8/3n4/8/8/3R4/4K3 w - - 0 1",
    playedUci: "e1f1",
    fenAfter: "4k3/8/8/3n4/8/8/3R4/5K2 b - - 0 1",
    best: line(0, ["e1e2", "e8e7", "d2d5"]),
    after: line(300, ["d5f6", "f1e2"]),
  });
  assert.equal(tag, "positional");
});

test("T10: positional", () => {
  const tag = tacticTag({
    mover: "w",
    fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    playedUci: "d2d4",
    fenAfter: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1",
    best: line(30, ["e2e4", "e7e5"]),
    after: line(-10, ["d7d5", "c2c4"]),
  });
  assert.equal(tag, "positional");
});

test("T11: positional - no lines", () => {
  const tag = tacticTag({
    mover: "w",
    fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    playedUci: "d2d4",
    fenAfter: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1",
  });
  assert.equal(tag, "positional");
});
