import { test } from "node:test";
import assert from "node:assert/strict";
import { exploreStatusText, yourLineText } from "../../../src/web/lib/exploreStatus.ts";

test("exploreStatusText: finished positions", () => {
  assert.equal(exploreStatusText({ kind: "finished", gameOver: "checkmate", winner: "w" }), "Checkmate. White wins.");
  assert.equal(exploreStatusText({ kind: "finished", gameOver: "checkmate", winner: "b" }), "Checkmate. Black wins.");
  assert.equal(exploreStatusText({ kind: "finished", gameOver: "stalemate" }), "Stalemate: a draw.");
  assert.equal(exploreStatusText({ kind: "finished", gameOver: "draw" }), "Drawn position.");
});

test("exploreStatusText: the other states", () => {
  assert.equal(exploreStatusText({ kind: "disconnected" }), "Connecting to the engine…");
  assert.equal(exploreStatusText({ kind: "error", message: "engine unavailable: boom" }), "Engine error: engine unavailable: boom");
  assert.equal(exploreStatusText({ kind: "waiting" }), "Searching…");
  assert.equal(exploreStatusText({ kind: "result", scoreText: "+0.3", depth: 24, done: false }), "+0.3 · depth 24 (searching…)");
  assert.equal(exploreStatusText({ kind: "result", scoreText: "+0.3", depth: 40, done: true }), "+0.3 · depth 40");
});

test("yourLineText: undefined with no moves yet", () => {
  const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  assert.equal(yourLineText(start, []), undefined);
});

test("yourLineText: numbers White's plies, starting from the position's own move number", () => {
  const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  assert.equal(yourLineText(start, ["e4", "e5", "Nf3"]), "Your line: 1. e4 e5 2. Nf3");
});

test("yourLineText: a line starting on Black's move gets the '...' prefix, from a mid-game position", () => {
  const midGame = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 2 3";
  assert.equal(yourLineText(midGame, ["Nf6", "Nc3"]), "Your line: 3... Nf6 4. Nc3");
});
