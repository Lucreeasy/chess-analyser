import type { GameRow } from "./types.ts";

/** Sorting the Games list. */

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

/** Two column values in a direction; a missing value sorts last in both directions; 0 leaves it to a tie-break. */
export function compareValues(av: string | number | undefined, bv: string | number | undefined, direction: SortDirection): number {
  if ((av === undefined) !== (bv === undefined)) return av === undefined ? 1 : -1;
  if (av === undefined || bv === undefined) return 0;
  const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
  return direction === "desc" ? -cmp : cmp;
}

/** Missing values sort last in both directions; tie-break newest played-at first, then id (id only when sorting by date itself). */
export function compareGames(a: GameRow, b: GameRow, key: SortKey, direction: SortDirection): number {
  const directed = compareValues(sortValue(a, key), sortValue(b, key), direction);
  if (directed !== 0) return directed;

  if (key !== "date") {
    const dateCmp = b.playedAt - a.playedAt;
    if (dateCmp !== 0) return dateCmp;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortGames(games: GameRow[], key: SortKey, direction: SortDirection): GameRow[] {
  return [...games].sort((a, b) => compareGames(a, b, key, direction));
}
