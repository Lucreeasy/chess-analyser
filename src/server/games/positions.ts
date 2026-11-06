import { extractTags, movetextOf } from "../import/pgnText.ts";
import { tokenizeMovetext } from "../import/movetext.ts";
import { resolveStartPosition, replayGame } from "../import/replay.ts";

export interface BoardPositions {
  /** FEN after ply 0 (start) .. ply N, as far as the replay got; length N+1 on full success. */
  fens: string[];
  /** Each position's move as "e2e4" (see Move.lan), parallel to `fens`; undefined at ply 0. */
  lastMoves: (string | undefined)[];
  /** Set when the game could not be read to the end (docs/06-GAMES-SPEC.md section B3). */
  failure?: string;
}

/**
 * Every board position for the Review screen, by fully replaying the
 * stored PGN (section B3: "otherwise by replaying the PGN so the board
 * works before analysis" - used for every game, not only unanalysed
 * ones, so the client never needs its own chess rules).
 */
export function positionsOf(pgn: string): BoardPositions {
  const start = resolveStartPosition(extractTags(pgn));
  if (start.failure) return { fens: [], lastMoves: [], failure: start.failure };

  const { moves } = tokenizeMovetext(movetextOf(pgn));
  const result = replayGame(start.fen, moves, true);
  return {
    fens: [start.fen, ...result.fens],
    lastMoves: [undefined, ...result.uci],
    failure: result.failure,
  };
}
