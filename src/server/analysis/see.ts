import { Chess } from "chess.js";
import {
  type Board,
  type Colour,
  type PieceType,
  PIECE_VALUE,
  attackersOf,
  balanceOf,
  boardOrderIndex,
  opponentOf,
  playSimplifiedMove,
  rankOf,
  withTurn,
} from "./material.ts";

/**
 * Static exchange evaluation (SEE) on the simplified board of material.ts.
 */

/**
 * Walks up to `maxPlies` of a UCI move line, stopping quietly at the first
 * move that cannot be played. Returns the balance (for `perspective`)
 * before the line and after each ply actually played.
 */
export function walkLine(
  board: Board,
  moves: string[],
  maxPlies: number,
  perspective: Colour,
): { before: number; afterEachPly: number[] } {
  const before = balanceOf(board, perspective);
  const afterEachPly: number[] = [];
  let current = board;
  for (let i = 0; i < Math.min(maxPlies, moves.length); i++) {
    const next = playSimplifiedMove(current, moves[i]);
    if (!next) break;
    current = next;
    afterEachPly.push(balanceOf(current, perspective));
  }
  return { before, afterEachPly };
}

/**
 * The exchange value on `square` for `side`. Recursive: the
 * first legal attacker, cheapest first (king last), captures; the result
 * nets the best the other side can still get by continuing the exchange.
 */
export function exchangeValue(board: Board, square: string, side: Colour): number {
  const game = new Chess(board, { skipValidation: true });
  const occupant = game.get(square as never);
  if (!occupant || occupant.color === side || occupant.type === "k") return 0;

  const attackers = attackersOf(board, square, side).sort((a, b) => {
    const pa = game.get(a as never)!;
    const pb = game.get(b as never)!;
    if (pa.type === "k" && pb.type !== "k") return 1;
    if (pb.type === "k" && pa.type !== "k") return -1;
    const diff = PIECE_VALUE[pa.type as PieceType] - PIECE_VALUE[pb.type as PieceType];
    return diff !== 0 ? diff : boardOrderIndex(a) - boardOrderIndex(b);
  });

  const promotionRank = rankOf(square) === 0 || rankOf(square) === 7;
  for (const attackerSquare of attackers) {
    const attacker = game.get(attackerSquare as never)!;
    const promotes = attacker.type === "p" && promotionRank;
    const uci = attackerSquare + square + (promotes ? "q" : "");
    const after = playSimplifiedMove(withTurn(board, side), uci);
    if (!after) continue; // illegal (would expose this side's own king): try the next attacker

    const gain = PIECE_VALUE[occupant.type as PieceType] + (promotes ? 8 : 0);
    const continuing = exchangeValue(after, square, opponentOf(side));
    return Math.max(0, gain - continuing);
  }
  return 0;
}

/** The static exchange loss of the piece on `square` (must hold a piece). */
export function staticExchangeLoss(board: Board, square: string): number {
  const piece = new Chess(board, { skipValidation: true }).get(square as never);
  if (!piece) return 0;
  return exchangeValue(board, square, opponentOf(piece.color));
}
