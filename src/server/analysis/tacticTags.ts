import { Chess } from "chess.js";
import {
  type Colour,
  type PieceType,
  PIECE_VALUE,
  capturedValue,
  opponentOf,
  parseSimplifiedBoard,
  playSimplifiedMove,
} from "./material.ts";
import { exchangeValue, walkLine } from "./see.ts";
import { type EngineLine, isForcedMateFor } from "./winPercent.ts";

/** docs/02-ANALYSIS-SPEC.md section 10. */
export type TacticTag = "allowed_mate" | "missed_mate" | "hung_piece" | "allowed_tactic" | "missed_tactic" | "positional";

export interface EngineLineWithPv extends EngineLine {
  pv: string[];
}

export interface TacticTagInput {
  mover: Colour;
  fenBefore: string;
  playedUci: string;
  fenAfter: string;
  /** The best line of the position before the move. */
  best?: EngineLineWithPv;
  /** The best line of the position after the move (the opponent's best play). */
  after?: EngineLineWithPv;
}

/** "settled(L)" of section 10.3: an odd look-ahead drops its last ply, except settled(1) = 1. */
const SETTLED: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 6 };

export function tacticTag(input: TacticTagInput): TacticTag {
  const { mover, fenBefore, playedUci, fenAfter, best, after } = input;
  const opponent = opponentOf(mover);

  if (after && isForcedMateFor(after, opponent)) return "allowed_mate";
  if (best && isForcedMateFor(best, mover)) return "missed_mate";

  let board: string;
  try {
    board = parseSimplifiedBoard(fenBefore);
  } catch {
    return "positional";
  }

  if (after && after.pv.length > 0) {
    const boardAfterMove = playSimplifiedMove(board, playedUci) ?? parseSimplifiedBoard(fenAfter);
    const reply = after.pv[0];
    const replyTo = reply.slice(2, 4);
    const target = new Chess(boardAfterMove, { skipValidation: true }).get(replyTo as never);
    if (target && PIECE_VALUE[target.type as PieceType] >= 3 && playSimplifiedMove(boardAfterMove, reply)) {
      const seeGain = exchangeValue(boardAfterMove, replyTo, opponent);
      if (seeGain - capturedValue(board, playedUci) >= 1) return "hung_piece";
    }
  }

  if (after && after.pv.length > 0) {
    const plies = 1 + SETTLED[Math.min(after.pv.length, 6)];
    const { before, afterEachPly } = walkLine(board, [playedUci, ...after.pv], plies, mover);
    if (afterEachPly.length > 0 && before - afterEachPly[afterEachPly.length - 1] >= 2) return "allowed_tactic";
  }

  if (best && best.pv.length > 0) {
    const plies = SETTLED[Math.min(best.pv.length, 6)];
    const { before, afterEachPly } = walkLine(board, best.pv, plies, mover);
    if (afterEachPly.length > 0 && afterEachPly[afterEachPly.length - 1] - before >= 2) return "missed_tactic";
  }

  return "positional";
}
