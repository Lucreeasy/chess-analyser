import { test } from "node:test";
import assert from "node:assert/strict";
import { analyseGame, type AnalyseGameInput } from "../../../src/server/analysis/game.ts";

function close(got: number, expected: number, tolerance = 1e-3): void {
  assert.ok(Math.abs(got - expected) < tolerance, `got ${got}, expected ${expected}`);
}

// docs/02-ANALYSIS-SPEC.md 18.5, end-to-end: Scholar's mate, my colour White.
// prettier-ignore
const FENS = [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2",
  "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3", "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
  "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4",
];

const input: AnalyseGameInput = {
  positions: [
    { fen: FENS[0], lines: [{ cp: 30, pv: ["e2e4", "e7e5"] }, { cp: 25, pv: ["d2d4", "d7d5"] }] },
    { fen: FENS[1], lines: [{ cp: 30, pv: ["e7e5", "g1f3"] }, { cp: 40, pv: ["c7c5", "g1f3"] }] },
    { fen: FENS[2], lines: [{ cp: 40, pv: ["g1f3", "b8c6"] }, { cp: 30, pv: ["f1c4", "g8f6"] }] },
    { fen: FENS[3], lines: [{ cp: 25, pv: ["b8c6", "g1f3"] }, { cp: 35, pv: ["g8f6", "b1c3"] }] },
    { fen: FENS[4], lines: [{ cp: 27, pv: ["g1f3", "g8f6"] }, { cp: 15, pv: ["d2d3", "g8f6"] }] },
    { fen: FENS[5], lines: [{ cp: 10, pv: ["g7g6", "h5f3"] }, { cp: 60, pv: ["d8e7", "h5e5"] }] },
    { fen: FENS[6], lines: [{ mate: 1, pv: ["h5f7"] }] },
    { fen: FENS[7], lines: [], terminalWhiteWinPercent: 100 },
  ],
  plies: [
    { colour: "w", san: "e4", uci: "e2e4" },
    { colour: "b", san: "e5", uci: "e7e5" },
    { colour: "w", san: "Bc4", uci: "f1c4" },
    { colour: "b", san: "Nc6", uci: "b8c6" },
    { colour: "w", san: "Qh5", uci: "d1h5" },
    { colour: "b", san: "Nf6", uci: "g8f6" },
    { colour: "w", san: "Qxf7#", uci: "h5f7" },
  ],
  timeControlText: "-",
  engineName: "Stockfish 18",
  depth: 16,
  myColour: "w",
};

test("per-move classes, tags and Win%/accuracy match the spec's table", () => {
  const { moves } = analyseGame(input);
  assert.equal(moves.length, 7);

  const expected: Array<[string, string, number, number, number, number]> = [
    ["book", "", 52.7588, 52.7588, 0, 100.0],
    ["book", "", 52.7588, 53.6754, 0.0092, 96.963],
    ["book", "", 53.6754, 52.2997, 0.0138, 95.001],
    // Not "book": docs/OPEN-QUESTIONS.md #5 - this position is not a key in reference/data/openings.json,
    // even though the spec's prose says it is. Same accuracy either way (the label doesn't affect EP loss).
    ["best", "", 52.2997, 52.4834, 0.0018, 100.0],
    ["excellent", "", 52.4834, 50.9204, 0.0156, 94.2123],
    ["blunder", "allowed_mate", 50.9204, 97.5447, 0.4662, 11.3796],
    ["best", "", 97.5447, 100.0, 0, 100.0],
  ];

  for (let i = 0; i < 7; i++) {
    const [cls, tag, before, after, loss, accuracy] = expected[i];
    const move = moves[i];
    assert.equal(move.classification, cls, `ply ${i + 1} class`);
    assert.equal(move.tag ?? "", tag, `ply ${i + 1} tag`);
    close(move.winPercentBefore, before, 1e-3);
    close(move.winPercentAfter, after, 1e-3);
    close(move.epLoss, loss, 1e-3);
    close(move.accuracy, accuracy, 1e-3);
    assert.equal(move.phase, "opening");
  }
});

test("per-game summary: accuracy, counts, phase accuracy, max/min EP", () => {
  const { summary } = analyseGame(input);

  close(summary.accuracy.w, 97.36867025660985);
  close(summary.accuracy.b, 22.904405023443147);

  assert.equal(summary.counts.w.book, 2);
  assert.equal(summary.counts.w.best, 1);
  assert.equal(summary.counts.w.excellent, 1);
  // Black: book1 (e5), best1 (Nc6, see docs/OPEN-QUESTIONS.md #5), blunder1 (Nf6).
  assert.equal(summary.counts.b.book, 1);
  assert.equal(summary.counts.b.best, 1);
  assert.equal(summary.counts.b.blunder, 1);

  close(summary.phaseAccuracy.w.opening!, 97.22771158987146);
  close(summary.phaseAccuracy.b.opening!, 27.72906197908842);

  close(summary.maxEp.w, 1);
  close(summary.maxEp.b, 0.49079583987119135);
  close(summary.minEp.w, 0.5092041601288086);
  close(summary.minEp.b, 0);
});

test("key moments: plies 3, 5 and 6 with the spec's exact sentences", () => {
  const { summary } = analyseGame(input);
  assert.deepEqual(summary.keyMoments.map((k) => k.ply), [3, 5, 6]);
  assert.equal(summary.keyMoments[0].sentence, "You played Bc4 which cost 1 points of winning chances; best was Nf3");
  assert.equal(summary.keyMoments[1].sentence, "You played Qh5 which cost 2 points of winning chances; best was Nf3");
  assert.equal(
    summary.keyMoments[2].sentence,
    "Opponent played Nf6?? which allowed Qxf7# and a forced mate; best was g6",
  );
  close(summary.keyMoments[0].swing, 1.3757619722840744);
  close(summary.keyMoments[1].swing, 1.5629429523584264);
  close(summary.keyMoments[2].swing, 46.62432762126237);
});

test("an empty game: no moves, start position counts as Win% 50, accuracy 100/100", () => {
  const { moves, summary } = analyseGame({
    positions: [{ fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1", lines: [] }],
    plies: [],
    timeControlText: "-",
    engineName: "Stockfish 18",
    depth: 16,
  });
  assert.equal(moves.length, 0);
  assert.equal(summary.accuracy.w, 100);
  assert.equal(summary.accuracy.b, 100);
  assert.equal(summary.maxEp.w, 0.5);
  assert.equal(summary.minEp.w, 0.5);
  assert.deepEqual(summary.keyMoments, []);
});
