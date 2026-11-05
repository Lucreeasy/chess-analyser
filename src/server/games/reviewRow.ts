import type Database from "better-sqlite3";
import type { StoredGame } from "../import/parseGame.ts";
import type { GameAnalysis } from "../analysis/game.ts";
import type { DepthPreset } from "../settings.ts";
import { getAnalysis, getAnalysisError } from "../db.ts";
import { analysisStatusOf, opponentOf, opponentRatingOf, type AnalysisStatus } from "./shared.ts";

/** A game as the Review screen needs it. docs/06-GAMES-SPEC.md Part B. */
export interface GameReviewRow extends Omit<StoredGame, "analysisStatus"> {
  analysisStatus: AnalysisStatus;
  opponent: string | undefined;
  opponentRating: number | undefined;
  depth?: DepthPreset;
  analysis?: GameAnalysis;
  errorMessage?: string;
}

export function toGameReviewRow(db: Database.Database, game: StoredGame): GameReviewRow {
  const status = analysisStatusOf(db, game.id);
  const stored = status === "done" ? getAnalysis(db, game.id) : undefined;

  return {
    ...game,
    analysisStatus: status,
    opponent: opponentOf(game),
    opponentRating: opponentRatingOf(game),
    depth: stored?.depth,
    analysis: stored?.analysis,
    errorMessage: status === "error" ? getAnalysisError(db, game.id) : undefined,
  };
}
