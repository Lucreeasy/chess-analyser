import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { analyseGame, type AnalyseGameInput } from "../../../src/server/analysis/game.ts";
import type { EngineLineWithPv } from "../../../src/server/analysis/tacticTags.ts";

function close(got: number, expected: number, tolerance = 1e-3): void {
  assert.ok(Math.abs(got - expected) < tolerance, `got ${got}, expected ${expected}`);
}

// End-to-end: Scholar's mate, my colour White.
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

test("per-move classes, tags and Win%/accuracy match the reference table", () => {
  const { moves } = analyseGame(input);
  assert.equal(moves.length, 7);

  const expected: Array<[string, string, number, number, number, number]> = [
    ["book", "", 52.7588, 52.7588, 0, 100.0],
    ["book", "", 52.7588, 53.6754, 0.0092, 96.963],
    ["book", "", 53.6754, 52.2997, 0.0138, 95.001],
    // Not "book": this position is not a key in the opening book (src/server/data/openings.json),
    // even though the worked example's prose says it is. Same accuracy either way (the label doesn't affect EP loss).
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

test("engineLineText: bestLine's first plies as move text, from fenBefore", () => {
  const { moves } = analyseGame(input);
  assert.equal(moves[0]!.engineLineText, "1. e4 e5"); // from the start position, White to move
  assert.equal(moves[6]!.engineLineText, "4. Qxf7#"); // mating line, one ply only
});

test("per-game summary: accuracy, counts, phase accuracy, max/min EP", () => {
  const { summary } = analyseGame(input);

  close(summary.accuracy.w, 97.36867025660985);
  close(summary.accuracy.b, 22.904405023443147);

  assert.equal(summary.counts.w.book, 2);
  assert.equal(summary.counts.w.best, 1);
  assert.equal(summary.counts.w.excellent, 1);
  // Black: book1 (e5), best1 (Nc6, not in the book, see above), blunder1 (Nf6).
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

test("key moments: plies 3, 5 and 6 with their exact sentences", () => {
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

// The full examples with positions: one-move games through the whole pipeline, my colour White. They assume
// no opening book, so the start position appears without castling rights: the same moves and lines, but no
// position of these games is a book position.
const BASE = { timeControlText: "-", engineName: "test", depth: 16, myColour: "w" } as const;
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";
const E3_BEFORE: EngineLineWithPv[] = [
  { cp: 30, pv: ["e2e4", "e7e5"] },
  { cp: 25, pv: ["d2d4"] },
];

// prettier-ignore
const EXAMPLES: Array<[string, string, string, EngineLineWithPv[], EngineLineWithPv[] | "terminal", number, number, number, number, string, string]> = [
  ["E1", START, "e2e4", [{ cp: 0, pv: ["e2e4", "e7e5"] }, { cp: -300, pv: ["d2d4", "d7d5"] }], [{ cp: 0, pv: ["e7e5"] }], 50.0, 50.0, 0, 100, "great", ""],
  ["E2", "4k3/8/4p3/8/8/8/8/3QK3 w - - 0 1", "d1d5", [{ cp: 150, pv: ["d1d5", "e6d5"] }], [{ cp: 150, pv: ["e6d5", "e1e2"] }], 63.47, 63.47, 0, 100, "brilliant", ""],
  ["E3", START, "d2d4", E3_BEFORE, [{ cp: 10, pv: ["d7d5", "c2c4"] }], 52.76, 50.92, 0.0184, 93.06, "excellent", ""],
  ["E4", START, "d2d4", E3_BEFORE, [{ cp: 0, pv: ["d7d5", "c2c4"] }], 52.76, 50.0, 0.0276, 89.32, "good", ""],
  ["E5", START, "d2d4", E3_BEFORE, [{ cp: -60, pv: ["d7d5", "c2c4"] }], 52.76, 44.5, 0.0826, 69.84, "inaccuracy", "positional"],
  ["E6", "4k3/8/8/3n4/8/8/3R4/4K3 w - - 0 1", "e1f1", [{ cp: 500, pv: ["d2d5", "e8e7"] }], [{ cp: 300, pv: ["d5f6", "f1e2"] }], 86.31, 75.11, 0.1119, 61.2, "mistake", "missed_tactic"],
  ["E7", "4k3/8/8/5n2/8/8/8/3QK3 w - - 0 1", "d1d4", [{ cp: 0, pv: ["d1d2"] }], [{ cp: -800, pv: ["f5d4", "e1e2"] }], 50.0, 4.99, 0.4501, 12.37, "blunder", "hung_piece"],
  ["E8", "4k3/8/8/4n3/8/8/P2R4/6K1 w - - 0 1", "a2a3", [{ cp: 300, pv: ["d2d3"] }], [{ cp: -200, pv: ["e5f3", "g1f1", "f3d2", "f1e1"] }], 75.11, 32.38, 0.4273, 13.88, "blunder", "allowed_tactic"],
  ["E9", START, "f2f3", [{ cp: 30, pv: ["e2e4"] }], [{ mate: -3, pv: ["e7e5"] }], 52.76, 2.46, 0.503, 9.37, "blunder", "allowed_mate"],
  ["E10", "k7/8/2K5/8/8/8/1Q6/8 w - - 0 1", "b2b6", [{ mate: 1, pv: ["b2b7"] }, { cp: 900, pv: ["b2a3"] }], "terminal", 97.54, 50.0, 0.4754, 10.85, "blunder", "missed_mate"],
];

for (const [name, fen, uci, before, after, wBefore, wAfter, loss, accuracy, cls, tag] of EXAMPLES) {
  test(`full example ${name}: ${cls}${tag ? `, ${tag}` : ""}`, () => {
    const game = new Chess(fen);
    const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
    const after1 = after === "terminal" ? { fen: game.fen(), lines: [], terminalWhiteWinPercent: 50 } : { fen: game.fen(), lines: after };
    const [m] = analyseGame({ ...BASE, positions: [{ fen, lines: before }, after1], plies: [{ colour: "w", san: move.san, uci }] }).moves;
    assert.deepEqual([m.classification, m.tag ?? ""], [cls, tag]);
    close(m.winPercentBefore, wBefore, 0.005);
    close(m.winPercentAfter, wAfter, 0.005);
    close(m.epLoss, loss, 0.00005);
    close(m.accuracy, accuracy, 0.005);
  });
}

// The Miss examples: after 1.e4 (castling rights dropped, no book), 1...f6 is a positional blunder; 2.Nf3 then
// fails to punish it by how much the position after it is worth.
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b - - 0 1";
for (const [name, cpAfter, wAfter, loss, cls, tag] of [
  ["M1", 150, 63.47, 0.2664, "miss", "positional"],
  ["M2", 300, 75.11, 0.15, "miss", "positional"],
  ["M3", -100, 40.9, 0.4921, "blunder", "positional"],
  ["M4", 700, 92.94, 0, "excellent", ""],
] as const) {
  test(`miss example ${name}: 2.Nf3 is ${cls}`, () => {
    const game = new Chess(AFTER_E4);
    const fens = [AFTER_E4, game.move("f6") && game.fen(), game.move("Nf3") && game.fen()];
    const [f6, nf3] = analyseGame({
      ...BASE,
      positions: [
        { fen: fens[0], lines: [{ cp: 30, pv: ["e7e5"] }, { cp: 40, pv: ["c7c5"] }] },
        { fen: fens[1], lines: [{ cp: 600, pv: ["d2d4"] }, { cp: 450, pv: ["b1c3"] }] },
        { fen: fens[2], lines: [{ cp: cpAfter, pv: ["e7e5"] }] },
      ],
      plies: [
        { colour: "b", san: "f6", uci: "f7f6" },
        { colour: "w", san: "Nf3", uci: "g1f3" },
      ],
    }).moves;
    assert.deepEqual([f6.classification, f6.tag], ["blunder", "positional"]);
    close(f6.winPercentAfter, 90.11, 0.005);
    close(f6.epLoss, 0.3735, 0.00005);
    assert.deepEqual([nf3.classification, nf3.tag ?? ""], [cls, tag]);
    close(nf3.winPercentAfter, wAfter, 0.005);
    close(nf3.epLoss, loss, 0.00005);
  });
}
