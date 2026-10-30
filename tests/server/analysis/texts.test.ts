import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMoveExplanation, buildKeyMomentSentence, annotatedSan } from "../../../src/server/analysis/texts.ts";

// docs/02-ANALYSIS-SPEC.md 15.3 examples.
test("move explanation: Blunder with a tag and a differing best move", () => {
  const text = buildMoveExplanation({
    cls: "blunder",
    tag: "hung_piece",
    moverWinPercentBefore: 52,
    moverWinPercentAfter: 20,
    mover: "w",
    myColour: "w",
    bestSan: "d4",
  });
  assert.equal(text, "Blunder (??). A serious error. Win chance for you: 52% → 20%. Best was d4. It left a piece hanging.");
});

test("move explanation: Best never shows a 'Best was' line", () => {
  const text = buildMoveExplanation({
    cls: "best",
    moverWinPercentBefore: 98,
    moverWinPercentAfter: 100,
    mover: "w",
    myColour: "w",
  });
  assert.equal(text, "Best. The engine's first choice. Win chance for you: 98% → 100%.");
});

test("move explanation: Excellent shows 'Best was' when it differs", () => {
  const text = buildMoveExplanation({
    cls: "excellent",
    moverWinPercentBefore: 52,
    moverWinPercentAfter: 51,
    mover: "w",
    myColour: "w",
    bestSan: "Nf3",
  });
  assert.equal(text, "Excellent. Almost as good as the best move. Win chance for you: 52% → 51%. Best was Nf3.");
});

test("annotatedSan appends the class glyph", () => {
  assert.equal(annotatedSan("Nxe5", "blunder"), "Nxe5??");
  assert.equal(annotatedSan("e4", "best"), "e4");
});

// docs/02-ANALYSIS-SPEC.md 13.2 examples.
test("key moment: allowed_mate with a known reply", () => {
  const text = buildKeyMomentSentence({
    tag: "allowed_mate",
    mover: "b",
    myColour: "w",
    move: "Nf6??",
    replySan: "Qxf7#",
    bestSan: "g6",
    swing: 46.6,
  });
  assert.equal(text, "Opponent played Nf6?? which allowed Qxf7# and a forced mate; best was g6");
});

test("key moment: hung_piece naming the captured piece", () => {
  const text = buildKeyMomentSentence({
    tag: "hung_piece",
    mover: "w",
    myColour: "w",
    move: "Qd5??",
    replySan: "exd5",
    replyPieceCaptured: "queen",
    bestSan: "Qd2",
    swing: 60,
  });
  assert.equal(text, "You played Qd5?? which allowed exd5 winning the queen; best was Qd2");
});

test("key moment: generic swing without a known best move drops the clause entirely", () => {
  const text = buildKeyMomentSentence({
    mover: "w",
    myColour: "w",
    move: "d4??",
    swing: 40,
  });
  assert.equal(text, "You played d4?? which cost 40 points of winning chances");
});

// docs/02-ANALYSIS-SPEC.md 18.5, Scholar's mate key moments.
test("Scholar's mate: ply 3 and 5 (generic, with best), ply 6 (allowed_mate)", () => {
  assert.equal(
    buildKeyMomentSentence({ mover: "w", myColour: "w", move: "Bc4", bestSan: "Nf3", swing: 1.3757619722840744 }),
    "You played Bc4 which cost 1 points of winning chances; best was Nf3",
  );
  assert.equal(
    buildKeyMomentSentence({ mover: "w", myColour: "w", move: "Qh5", bestSan: "Nf3", swing: 1.5629429523584264 }),
    "You played Qh5 which cost 2 points of winning chances; best was Nf3",
  );
  assert.equal(
    buildKeyMomentSentence({
      tag: "allowed_mate",
      mover: "b",
      myColour: "w",
      move: "Nf6??",
      replySan: "Qxf7#",
      bestSan: "g6",
      swing: 46.62432762126237,
    }),
    "Opponent played Nf6?? which allowed Qxf7# and a forced mate; best was g6",
  );
});

test("Scholar's mate: with my colour Black, 'You'; with it unknown, 'Black'", () => {
  const base = { tag: "allowed_mate" as const, mover: "b" as const, move: "Nf6??", replySan: "Qxf7#", bestSan: "g6", swing: 46.6 };
  assert.match(buildKeyMomentSentence({ ...base, myColour: "b" }), /^You played Nf6\?\? /);
  assert.match(buildKeyMomentSentence({ ...base, myColour: undefined }), /^Black played Nf6\?\? /);
});
