import type { GameRow, TimeClass } from "./types.ts";
import { parseInsightsQuery } from "../../server/insights/select.ts";

/** Search and filters for the Games list. */

export interface GamesFilters {
  search: string;
  timeClasses: Set<TimeClass>;
  colour: "any" | "w" | "b";
  results: Set<"win" | "loss" | "draw">;
  analysis: "any" | "analysed" | "not_analysed";
  openingFamily: string | undefined;
  /** UTC day boundaries, inclusive: From = 00:00:00.000 UTC, To = 23:59:59.999 UTC. */
  from: number | undefined;
  to: number | undefined;
  /** Insights only: "All time" was chosen, so no default date range applies. */
  allTime: boolean;
  /** An exact list of games from an Insights drill-down (shown as a chip, not counted). */
  ids: Set<string> | undefined;
  /** Display only, never matched: the chip's label and the "approximate" notice. */
  label: string | undefined;
  approximate: boolean;
}

export function defaultFilters(): GamesFilters {
  return {
    search: "",
    timeClasses: new Set(),
    colour: "any",
    results: new Set(),
    analysis: "any",
    openingFamily: undefined,
    from: undefined,
    to: undefined,
    allTime: false,
    ids: undefined,
    label: undefined,
    approximate: false,
  };
}

/**
 * A library address from elsewhere, e.g. `#/games?ids=a,b&label=...` from an Insights number: the Insights query
 * format plus the library's own analysis filter, label and "approximate" flag.
 */
export function filtersFromQuery(query: string): GamesFilters {
  const params = new URLSearchParams(query);
  const { filters, allTime } = parseInsightsQuery(params);
  const analysis = params.get("analysis");
  return {
    ...defaultFilters(),
    timeClasses: new Set(filters.timeClasses),
    colour: filters.colour ?? "any",
    results: new Set(filters.results),
    analysis: analysis === "analysed" || analysis === "not_analysed" ? analysis : "any",
    openingFamily: filters.family,
    from: filters.from,
    to: filters.to,
    allTime,
    ids: filters.ids?.length ? new Set(filters.ids) : undefined,
    label: params.get("label") ?? undefined,
    approximate: params.get("approx") === "1",
  };
}

function matchesSearch(game: GameRow, search: string): boolean {
  if (search === "") return true;
  const needle = search.toLowerCase();
  const haystacks: string[] = [];
  if (game.myColour === undefined) haystacks.push(game.white, game.black);
  else if (game.opponent) haystacks.push(game.opponent);
  if (game.openingName) haystacks.push(game.openingName);
  if (game.eco) haystacks.push(game.eco);
  return haystacks.some((h) => h.toLowerCase().includes(needle));
}

export function matchesFilters(game: GameRow, filters: GamesFilters): boolean {
  if (!matchesSearch(game, filters.search)) return false;
  if (filters.timeClasses.size > 0 && !filters.timeClasses.has(game.timeClass)) return false;
  if (filters.colour === "w" && game.myColour !== "w") return false;
  if (filters.colour === "b" && game.myColour !== "b") return false;
  if (filters.results.size > 0 && (game.myResult === undefined || !filters.results.has(game.myResult))) return false;
  if (filters.analysis === "analysed" && game.analysisStatus !== "done") return false;
  if (filters.analysis === "not_analysed" && game.analysisStatus === "done") return false;
  if (filters.openingFamily !== undefined && game.openingFamily !== filters.openingFamily) return false;
  if (filters.from !== undefined && game.playedAt < filters.from) return false;
  if (filters.to !== undefined && game.playedAt > filters.to) return false;
  if (filters.ids && !filters.ids.has(game.id)) return false;
  return true;
}

export function filterGames(games: GameRow[], filters: GamesFilters): GameRow[] {
  return games.filter((game) => matchesFilters(game, filters));
}

/** One for each of time class, colour, result, opening family, analysis, search, and the date range as a whole. */
export function activeFilterCount(filters: GamesFilters): number {
  let count = 0;
  if (filters.timeClasses.size > 0) count++;
  if (filters.colour !== "any") count++;
  if (filters.results.size > 0) count++;
  if (filters.analysis !== "any") count++;
  if (filters.openingFamily !== undefined) count++;
  if (filters.search !== "") count++;
  if (filters.from !== undefined || filters.to !== undefined) count++;
  // Insights: an explicit "All time" counts only when nothing else is active.
  return count === 0 && filters.allTime ? 1 : count;
}

export interface Facets {
  timeClasses: Set<TimeClass>;
  openingFamilies: Array<{ family: string; count: number }>;
}

/** Over the whole (unfiltered) library. */
export function computeFacets(games: GameRow[]): Facets {
  const timeClasses = new Set<TimeClass>();
  const familyCounts = new Map<string, number>();
  for (const game of games) {
    timeClasses.add(game.timeClass);
    if (game.openingFamily) familyCounts.set(game.openingFamily, (familyCounts.get(game.openingFamily) ?? 0) + 1);
  }
  const openingFamilies = [...familyCounts.entries()]
    .map(([family, count]) => ({ family, count }))
    .sort((a, b) => b.count - a.count || a.family.localeCompare(b.family));
  return { timeClasses, openingFamilies };
}
