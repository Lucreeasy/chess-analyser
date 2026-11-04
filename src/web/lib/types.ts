export type TimeClass = "bullet" | "blitz" | "rapid" | "daily" | "classical";

/** Mirrors the server's GameListRow (src/server/games/listRows.ts). */
export interface GameRow {
  id: string;
  white: string;
  black: string;
  whiteElo?: number;
  blackElo?: number;
  myColour?: "w" | "b";
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  myResult?: "win" | "loss" | "draw";
  timeControlText: string;
  timeClass: TimeClass;
  playedAt: number;
  eco?: string;
  openingName?: string;
  openingFamily?: string;
  plyCount: number;
  analysisStatus: "none" | "queued" | "running" | "done" | "error";
  opponent: string | undefined;
  opponentRating: number | undefined;
  accuracy: number | undefined;
  blunders: number | undefined;
}
