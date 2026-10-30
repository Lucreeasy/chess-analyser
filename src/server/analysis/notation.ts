import { Chess } from "chess.js";

/** SAN of `uci` played from `fen`, or undefined if it cannot be played there. */
export function sanOf(fen: string, uci: string): string | undefined {
  try {
    const game = new Chess(fen);
    const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] } as never);
    return move.san;
  } catch {
    return undefined;
  }
}

const PIECE_NAME = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" } as const;

/** The name of the piece `uci` captures from `fen`; "piece" if nothing (or unreadable). */
export function pieceCapturedBy(fen: string, uci: string): (typeof PIECE_NAME)[keyof typeof PIECE_NAME] | "piece" {
  try {
    const target = new Chess(fen).get(uci.slice(2, 4) as never);
    return target ? PIECE_NAME[target.type] : "piece";
  } catch {
    return "piece";
  }
}
