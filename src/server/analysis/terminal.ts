import { Chess } from "chess.js";

/**
 * White's Win% of a terminal position (section 2.5), or undefined when the
 * position is not terminal (and must be searched).
 */
export function terminalWhiteWinPercent(fen: string): number | undefined {
  const game = new Chess(fen);
  if (game.isCheckmate()) return game.turn() === "w" ? 0 : 100;
  if (game.isStalemate() || game.isInsufficientMaterial() || game.isDrawByFiftyMoves()) return 50;
  return undefined;
}
