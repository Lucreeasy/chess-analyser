import type Database from "better-sqlite3";
import type { StoredGame } from "../import/parseGame.ts";
import { gameAnalysisState } from "../analysisQueue/queue.ts";
import { getAnalysis } from "../db.ts";

/** A game as the Games list needs it. docs/06-GAMES-SPEC.md section A1. */
export interface GameListRow extends Omit<StoredGame, "analysisStatus"> {
  analysisStatus: "none" | "queued" | "running" | "done" | "error";
  opponent: string | undefined;
  opponentRating: number | undefined;
  accuracy: number | undefined;
  blunders: number | undefined;
}

const LIVE_STATUS: Record<"none" | "waiting" | "running" | "done" | "error", GameListRow["analysisStatus"]> = {
  none: "none",
  waiting: "queued",
  running: "running",
  done: "done",
  error: "error",
};

export function toGameListRow(db: Database.Database, game: StoredGame): GameListRow {
  const opponent = game.myColour === "w" ? game.black : game.myColour === "b" ? game.white : undefined;
  const opponentRating = game.myColour === "w" ? game.blackElo : game.myColour === "b" ? game.whiteElo : undefined;

  const status = LIVE_STATUS[gameAnalysisState(db, game.id)];
  const stored = status === "done" && game.myColour ? getAnalysis(db, game.id) : undefined;

  return {
    ...game,
    analysisStatus: status,
    opponent,
    opponentRating,
    accuracy: stored && game.myColour ? stored.analysis.summary.accuracy[game.myColour] : undefined,
    blunders: stored && game.myColour ? stored.analysis.summary.counts[game.myColour].blunder : undefined,
  };
}
