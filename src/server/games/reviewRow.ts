import type Database from "better-sqlite3";
import type { StoredGame } from "../import/parseGame.ts";
import type { GameAnalysis } from "../analysis/game.ts";
import type { DepthPreset } from "../settings.ts";
import { getAnalysis, getAnalysisError } from "../db.ts";
import { analysisStatusOf, opponentOf, opponentRatingOf, type AnalysisStatus } from "./shared.ts";
import { positionsOf, type BoardPositions } from "./positions.ts";

/** A game as the Review screen needs it. */
export interface GameReviewRow extends Omit<StoredGame, "analysisStatus"> {
  analysisStatus: AnalysisStatus;
  opponent: string | undefined;
  opponentRating: number | undefined;
  depth?: DepthPreset;
  analysis?: GameAnalysis;
  errorMessage?: string;
  positions: BoardPositions;
}

export function toGameReviewRow(db: Database.Database, game: StoredGame): GameReviewRow {
  const status = analysisStatusOf(db, game.id);
  // A re-analysed game keeps showing its old analysis
  // (not the Analyse panel) until the new one replaces it, so this isn't gated on status.
  const stored = getAnalysis(db, game.id);

  return {
    ...game,
    analysisStatus: status,
    opponent: opponentOf(game),
    opponentRating: opponentRatingOf(game),
    depth: stored?.depth,
    analysis: stored?.analysis,
    errorMessage: status === "error" ? getAnalysisError(db, game.id) : undefined,
    positions: positionsOf(game.pgn),
  };
}
