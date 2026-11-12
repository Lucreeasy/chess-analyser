import { Chess } from "chess.js";
import { type Colour, type PieceType, PIECE_VALUE, balanceOf, parseSimplifiedBoard, playSimplifiedMove } from "./material.ts";
import { staticExchangeLoss, walkLine } from "./see.ts";

/**
 * Is `uci`, played by `mover` from `fenBefore`, a sacrifice?
 * `pvAfter` is the PV (UCI moves) of the best line of the position AFTER the move (empty if none).
 */
export function isSacrifice(fenBefore: string, uci: string, mover: Colour, pvAfter: string[]): boolean {
  let board: string;
  try {
    board = parseSimplifiedBoard(fenBefore);
  } catch {
    return false;
  }
  const balanceBefore = balanceOf(board, mover);

  const after = playSimplifiedMove(board, uci);
  if (!after) return false;
  // "captured" + "promoted": the mover never loses material on their own move, so the whole gain is exactly
  // the balance change (a capture's value, plus a promotion's value-minus-one, or both at once).
  const gained = balanceOf(after, mover) - balanceBefore;

  // Test (a): static exchange, every remaining piece of the mover worth >= 3.
  const afterGame = new Chess(after, { skipValidation: true });
  for (const row of afterGame.board()) {
    for (const cell of row) {
      if (cell && cell.color === mover && PIECE_VALUE[cell.type as PieceType] >= 3) {
        if (staticExchangeLoss(after, cell.square) > gained) return true;
      }
    }
  }

  // Test (b): material along the first two plies of the opponent's best reply.
  const { afterEachPly } = walkLine(after, pvAfter, 2, mover);
  if (afterEachPly.length === 0) return false;
  return balanceBefore - afterEachPly[afterEachPly.length - 1] >= 2;
}
