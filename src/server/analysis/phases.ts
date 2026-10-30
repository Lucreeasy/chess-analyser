import { Chess } from "chess.js";

/** docs/02-ANALYSIS-SPEC.md section 11. */
export type Phase = "opening" | "middlegame" | "endgame";

const PHASE_ORDER: Record<Phase, number> = { opening: 0, middlegame: 1, endgame: 2 };

function countPieces(game: Chess): number {
  let count = 0;
  for (const row of game.board()) {
    for (const cell of row) {
      if (cell && cell.type !== "p" && cell.type !== "k") count++;
    }
  }
  return count;
}

function backRankCount(game: Chess, colour: "w" | "b"): number {
  const rank = colour === "w" ? "1" : "8";
  let count = 0;
  for (const file of "abcdefgh") {
    const piece = game.get((file + rank) as never);
    if (piece && piece.color === colour) count++;
  }
  return count;
}

/** The raw phase of the position after ply `ply`, with its book flag. Section 11.1. */
export function rawPhase(fen: string, ply: number, inBook: boolean): Phase {
  const game = new Chess(fen, { skipValidation: true });
  const pieces = countPieces(game);
  if (pieces <= 6) return "endgame";
  if (pieces <= 10 || backRankCount(game, "w") < 4 || backRankCount(game, "b") < 4 || (ply > 10 && !inBook)) {
    return "middlegame";
  }
  return "opening";
}

/** The phase of every ply of a game: it never goes back. Section 11.2. */
export function phasesOf(fensAfterEachPly: string[], bookFlags: boolean[]): Phase[] {
  let current: Phase = "opening";
  return fensAfterEachPly.map((fen, i) => {
    const raw = rawPhase(fen, i + 1, bookFlags[i]);
    if (PHASE_ORDER[raw] > PHASE_ORDER[current]) current = raw;
    return current;
  });
}
