import { Chess } from "chess.js";

/**
 * The "simplified board": a deliberately looser model than real chess rules (castling rights, the
 * en-passant field and move counters are ignored). Used only to answer
 * "is this piece lost/won by force" for the Brilliant check and the
 * tactic tags - see.ts builds the exchange evaluation on top
 * of it.
 *
 * Built on chess.js (loaded with `skipValidation` so a toy position - one
 * side's king missing, say - still works) rather than a second hand-written
 * rules engine: real chess.js legality (including pins) matches this model
 * exactly for every move except castling and en passant, where the model is
 * deliberately looser than real chess, so only those two are special-cased.
 */

export type Colour = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

export const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** A FEN with castling rights, the en-passant field and move counters normalised away. */
export type Board = string;

export function opponentOf(colour: Colour): Colour {
  return colour === "w" ? "b" : "w";
}

export function fileOf(square: string): number {
  return square.charCodeAt(0) - "a".charCodeAt(0);
}
export function rankOf(square: string): number {
  return Number(square[1]) - 1;
}

/** Board order for ties: a8, b8, ..., h8, a7, ..., h1. */
export function boardOrderIndex(square: string): number {
  return (7 - rankOf(square)) * 8 + fileOf(square);
}

function engineOf(board: Board): Chess {
  return new Chess(board, { skipValidation: true });
}

/** Parses a FEN into a simplified board: keeps only placement and side to move. */
export function parseSimplifiedBoard(fen: string): Board {
  const [placement, turn] = fen.split(" ");
  return `${placement} ${turn === "b" ? "b" : "w"} - - 0 1`;
}

export function withTurn(board: Board, turn: Colour): Board {
  return `${board.split(" ")[0]} ${turn} - - 0 1`;
}

export function materialOf(board: Board, colour: Colour): number {
  let total = 0;
  for (const row of engineOf(board).board()) {
    for (const cell of row) {
      if (cell && cell.color === colour) total += PIECE_VALUE[cell.type as PieceType];
    }
  }
  return total;
}

export function balanceOf(board: Board, colour: Colour): number {
  return materialOf(board, colour) - materialOf(board, opponentOf(colour));
}

/** The value of what `uci` captures from `board` (0 if nothing, 1 for an en-passant-style capture). */
export function capturedValue(board: Board, uci: string): number {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const game = engineOf(board);
  const mover = game.turn();
  const target = game.get(to as never);
  if (target) return target.color === mover ? 0 : PIECE_VALUE[target.type as PieceType];
  const piece = game.get(from as never);
  if (piece?.type === "p" && fileOf(to) !== fileOf(from)) {
    const beside = game.get((to[0] + from[1]) as never);
    if (beside && beside.type === "p" && beside.color !== mover) return 1;
  }
  return 0;
}

/** Pseudo-legal attackers of `square` by `colour`, in board order. */
export function attackersOf(board: Board, square: string, colour: Colour): string[] {
  return (engineOf(board).attackers(square as never, colour) as string[])
    .slice()
    .sort((a, b) => boardOrderIndex(a) - boardOrderIndex(b));
}

/**
 * Castling on the simplified board: a rook physically in the corner and an empty
 * path is enough (rights are not checked), and the squares the king passes
 * through are not checked for attack (only the final position is, via the
 * general post-move rule).
 */
function looseCastle(board: Board, from: string, to: string): Board | null {
  const game = engineOf(board);
  const mover = game.turn();
  const rankChar = from[1];
  const kingside = to[0] === "g";
  const rookFrom = (kingside ? "h" : "a") + rankChar;
  const rookTo = (kingside ? "f" : "d") + rankChar;
  const rook = game.get(rookFrom as never);
  if (!rook || rook.type !== "r" || rook.color !== mover) return null;
  const between = kingside ? ["f", "g"] : ["b", "c", "d"];
  if (between.some((f) => game.get((f + rankChar) as never))) return null;

  game.remove(from as never);
  game.remove(rookFrom as never);
  game.put({ type: "k", color: mover }, to as never);
  game.put({ type: "r", color: mover }, rookTo as never);

  const opponent = opponentOf(mover);
  const result = `${game.fen().split(" ")[0]} ${opponent} - - 0 1`;
  if (engineOf(result).isAttacked(to as never, opponent)) return null; // the king's new square is unsafe
  return result;
}

/**
 * Plays one UCI move (from+to+optional promotion) on the simplified board.
 * Returns the resulting board, or `null` if the move is illegal.
 */
export function playSimplifiedMove(board: Board, uci: string): Board | null {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;

  const game = engineOf(board);
  const mover = game.turn();
  const piece = game.get(from as never);
  if (!piece || piece.color !== mover) return null;

  if (piece.type === "k" && fileOf(from) === 4 && to[1] === from[1] && Math.abs(fileOf(to) - fileOf(from)) === 2) {
    return looseCastle(board, from, to);
  }

  // En-passant-like diagonal move onto an empty square beside an enemy pawn: the simplified board does not check
  // whether a double step was just played, only the current geometry - so the ep field is set ourselves.
  let working = board;
  if (piece.type === "p" && fileOf(to) !== fileOf(from) && !game.get(to as never)) {
    const beside = game.get((to[0] + from[1]) as never);
    if (beside && beside.type === "p" && beside.color !== mover) {
      working = `${board.split(" ")[0]} ${mover} - ${to} 0 1`;
    }
  }

  try {
    const result = engineOf(working);
    result.move({ from, to, promotion } as never);
    return parseSimplifiedBoard(result.fen());
  } catch {
    return null;
  }
}
