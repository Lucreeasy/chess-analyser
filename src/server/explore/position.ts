import { Chess, validateFen } from "chess.js";

/** The chess rules explore mode needs, kept server-side (the client has none). */

/** Legal destinations per origin square, for chessground's `movable.dests`; empty when the position is illegal. */
export function legalDestinations(fen: string): Record<string, string[]> {
  if (!isLegalPosition(fen)) return {};
  const dests: Record<string, string[]> = {};
  for (const move of new Chess(fen).moves({ verbose: true })) {
    (dests[move.from] ??= []).push(move.to);
  }
  return dests;
}

export type GameOver = "checkmate" | "stalemate" | "draw";

export interface MoveResult {
  ok: boolean;
  fen?: string;
  san?: string;
  uci?: string;
  gameOver?: GameOver;
  /** Set only for checkmate: the side that just moved. */
  winner?: "w" | "b";
}

/** Plays `uci` (e.g. "e7e8q") from `fen`; `ok: false` if the position or the move itself is illegal. */
export function applyMove(fen: string, uci: string): MoveResult {
  if (!isLegalPosition(fen)) return { ok: false };
  try {
    const game = new Chess(fen);
    const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] } as never);
    let gameOver: GameOver | undefined;
    let winner: "w" | "b" | undefined;
    if (game.isCheckmate()) {
      gameOver = "checkmate";
      winner = move.color;
    } else if (game.isStalemate()) {
      gameOver = "stalemate";
    } else if (game.isDraw()) {
      gameOver = "draw";
    }
    return { ok: true, fen: game.fen(), san: move.san, uci: move.lan, gameOver, winner };
  } catch {
    return { ok: false };
  }
}

/** Well-formed and not leaving the side not to move in check (the one case chess.js's own validator misses). */
export function isLegalPosition(fen: string): boolean {
  return explorePositionError(fen) === undefined;
}

/**
 * "positions the engine cannot take (invalid, or the side not to move
 * is in check) are rejected with `invalid FEN: ...`-style messages shown as the engine error." Undefined
 * when `fen` is fine to search.
 */
export function explorePositionError(fen: string): string | undefined {
  const validation = validateFen(fen);
  if (!validation.ok) return `invalid FEN: ${validation.error}`;
  try {
    const [board, side, castling] = fen.split(" ");
    const flipped = [board, side === "w" ? "b" : "w", castling, "-", "0", "1"].join(" ");
    if (new Chess(flipped).inCheck()) return "invalid FEN: the side not to move is in check";
    return undefined;
  } catch {
    return `invalid FEN: ${fen}`;
  }
}
