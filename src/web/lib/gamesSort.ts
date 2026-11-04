import type { GameRow } from "./types.ts";

/** Sorting the Games list. docs/06-GAMES-SPEC.md section A4. */

export type SortKey = "date" | "opponent" | "rating" | "colour" | "result" | "time" | "opening" | "accuracy" | "blunders" | "status";
export type SortDirection = "asc" | "desc";

/** A column's first direction when it becomes the active sort. */
export const FIRST_DIRECTION: Record<SortKey, SortDirection> = {
  date: "desc",
  rating: "desc",
  accuracy: "desc",
  blunders: "desc",
  opponent: "asc",
  colour: "asc",
  result: "asc",
  time: "asc",
  opening: "asc",
  status: "asc",
};

function sortValue(game: GameRow, key: SortKey): string | number | undefined {
  switch (key) {
    case "date":
      return game.playedAt;
    case "opponent":
      return game.opponent?.toLowerCase();
    case "rating":
      return game.opponentRating;
    case "colour":
      return game.myColour;
    case "result":
      return game.myResult;
    case "time":
      return game.timeClass;
    case "opening":
      return game.openingName?.toLowerCase();
    case "accuracy":
      return game.accuracy;
    case "blunders":
      return game.blunders;
    case "status":
      return game.analysisStatus;
  }
}

/** Missing values sort last in both directions; tie-break newest played-at first, then id (id only when sorting by date itself). */
export function compareGames(a: GameRow, b: GameRow, key: SortKey, direction: SortDirection): number {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  const aMissing = av === undefined;
  const bMissing = bv === undefined;
  if (aMissing !== bMissing) return aMissing ? 1 : -1;

  if (!aMissing && !bMissing) {
    const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
    const directed = direction === "desc" ? -cmp : cmp;
    if (directed !== 0) return directed;
  }

  if (key !== "date") {
    const dateCmp = b.playedAt - a.playedAt;
    if (dateCmp !== 0) return dateCmp;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortGames(games: GameRow[], key: SortKey, direction: SortDirection): GameRow[] {
  return [...games].sort((a, b) => compareGames(a, b, key, direction));
}
