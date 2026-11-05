import type Database from "better-sqlite3";
import { gameAnalysisState } from "../analysisQueue/queue.ts";

/** Pieces shared by the games-list row and the single-game review row. */

export type AnalysisStatus = "none" | "queued" | "running" | "done" | "error";

const LIVE_STATUS: Record<"none" | "waiting" | "running" | "done" | "error", AnalysisStatus> = {
  none: "none",
  waiting: "queued",
  running: "running",
  done: "done",
  error: "error",
};

export function analysisStatusOf(db: Database.Database, gameId: string): AnalysisStatus {
  return LIVE_STATUS[gameAnalysisState(db, gameId)];
}

export function opponentOf(game: { white: string; black: string; myColour?: "w" | "b" }): string | undefined {
  return game.myColour === "w" ? game.black : game.myColour === "b" ? game.white : undefined;
}

export function opponentRatingOf(game: { whiteElo?: number; blackElo?: number; myColour?: "w" | "b" }): number | undefined {
  return game.myColour === "w" ? game.blackElo : game.myColour === "b" ? game.whiteElo : undefined;
}
