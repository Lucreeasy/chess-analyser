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

/** `pv` as up to `maxPlies` numbered plies of move text from `fen`: "10. d4 Nbd7", "9... Nb8 10. d4". */
export function sanLineOf(fen: string, pv: string[], maxPlies: number): string {
  try {
    const game = new Chess(fen);
    let moveNumber = Number(fen.split(" ")[5]);
    const parts: string[] = [];
    for (const [index, uci] of pv.slice(0, maxPlies).entries()) {
      const turnBefore = game.turn();
      if (turnBefore === "w") parts.push(`${moveNumber}.`);
      else if (index === 0) parts.push(`${moveNumber}...`);
      const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] } as never);
      parts.push(move.san);
      if (turnBefore === "b") moveNumber++;
    }
    return parts.join(" ");
  } catch {
    return "";
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
