import type Database from "better-sqlite3";
import type { StoredGame } from "../import/parseGame.ts";
import { getAnalysis } from "../db.ts";
import { analysisStatusOf, opponentOf, opponentRatingOf, type AnalysisStatus } from "./shared.ts";

/** A game as the Games list needs it. docs/06-GAMES-SPEC.md section A1. */
export interface GameListRow extends Omit<StoredGame, "analysisStatus"> {
  analysisStatus: AnalysisStatus;
  opponent: string | undefined;
  opponentRating: number | undefined;
  accuracy: number | undefined;
  blunders: number | undefined;
}

export function toGameListRow(db: Database.Database, game: StoredGame): GameListRow {
  const status = analysisStatusOf(db, game.id);
  const stored = status === "done" && game.myColour ? getAnalysis(db, game.id) : undefined;

  return {
    ...game,
    analysisStatus: status,
    opponent: opponentOf(game),
    opponentRating: opponentRatingOf(game),
    accuracy: stored && game.myColour ? stored.analysis.summary.accuracy[game.myColour] : undefined,
    blunders: stored && game.myColour ? stored.analysis.summary.counts[game.myColour].blunder : undefined,
  };
}
