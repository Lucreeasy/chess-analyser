/**
 * Which games the Insights profile uses: the filters and the selection steps.
 * docs/04-INSIGHTS-SPEC.md sections 2 and 3.
 */
import type { StoredGame } from "../import/parseGame.ts";
import type { PersonalResult } from "../import/players.ts";
import type { TimeClass } from "../import/timeClass.ts";
import type { Colour, GameAnalysis } from "../analysis/game.ts";

export const MINIMUM_GAMES = 20;
const MINIMUM_MY_MOVES = 3;

export interface InsightFilters {
  timeClasses?: TimeClass[];
  colour?: Colour;
  results?: PersonalResult[];
  family?: string;
  /** Inclusive, ms since the epoch. */
  from?: number;
  /** Inclusive, ms since the epoch. */
  to?: number;
  ids?: string[];
}

/** A game as stored, with its analysis if it has one. */
export interface GameWithAnalysis {
  game: StoredGame;
  analysis?: GameAnalysis;
}

/** A game the profile uses: it has a "me" side and an analysis with move rows. */
export interface UsedGame {
  game: StoredGame;
  analysis: GameAnalysis;
  me: Colour;
}

export interface Selection {
  gamesTotal: number;
  /** In play order (played-at ascending, then id); empty when not ready. */
  used: UsedGame[];
  excluded: { notAnalysed: number; noMyColor: number; tooShort: number };
  analysed: number;
  minimum: number;
  ready: boolean;
  needed: number;
}

/** Section 3: a game must satisfy every filter that is set. */
export function matchesFilters(game: StoredGame, filters: InsightFilters): boolean {
  if (filters.timeClasses && !filters.timeClasses.includes(game.timeClass)) return false;
  if (filters.colour && game.myColour !== filters.colour) return false;
  if (filters.results && !(game.myResult && filters.results.includes(game.myResult))) return false;
  if (filters.family !== undefined && game.openingFamily !== filters.family) return false;
  if (filters.from !== undefined && game.playedAt < filters.from) return false;
  if (filters.to !== undefined && game.playedAt > filters.to) return false;
  if (filters.ids && !filters.ids.includes(game.id)) return false;
  return true;
}

/** The number of my moves: the sum of my side's class counts. */
function myMoveCount(analysis: GameAnalysis, me: Colour): number {
  return Object.values(analysis.summary.counts[me]).reduce((sum, n) => sum + n, 0);
}

export interface DefaultRange {
  kind: "days" | "games" | "all";
  /** Start of a UTC day; absent for kind "all". */
  from?: number;
}

const DAY_MS = 86_400_000;
const DEFAULT_DAYS = 30;
const DEFAULT_GAMES = 30;

function startOfUtcDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/**
 * Section 4: the range used when the user picked no dates and not "All time", over the games that match the
 * other filters and are usable (a "me" side, an analysis, at least 3 of my moves).
 */
export function defaultRange(games: GameWithAnalysis[], filters: InsightFilters, now: number): DefaultRange {
  const others = { ...filters, from: undefined, to: undefined };
  const playedAt = games
    .filter(({ game, analysis }) => matchesFilters(game, others) && game.myColour && analysis && myMoveCount(analysis, game.myColour) >= MINIMUM_MY_MOVES)
    .map(({ game }) => game.playedAt);
  const since = startOfUtcDay(now - DEFAULT_DAYS * DAY_MS);
  if (playedAt.filter((t) => t >= since).length >= MINIMUM_GAMES) return { kind: "days", from: since };
  if (playedAt.length >= DEFAULT_GAMES) return { kind: "games", from: startOfUtcDay(playedAt.sort((a, b) => b - a)[DEFAULT_GAMES - 1]) };
  return { kind: "all" };
}

/** Section 2: games matching, the exclusions, the gate of 20 and the play order. */
export function selectGames(games: GameWithAnalysis[], filters: InsightFilters): Selection {
  const excluded = { notAnalysed: 0, noMyColor: 0, tooShort: 0 };
  let gamesTotal = 0;
  let usable: UsedGame[] = [];
  for (const { game, analysis } of games) {
    if (!matchesFilters(game, filters)) continue;
    gamesTotal++;
    const me = game.myColour;
    if (!me) excluded.noMyColor++;
    else if (!analysis) excluded.notAnalysed++;
    else if (myMoveCount(analysis, me) < MINIMUM_MY_MOVES) excluded.tooShort++;
    else usable.push({ game, analysis, me });
  }
  if (usable.length >= MINIMUM_GAMES) {
    usable.sort((a, b) => a.game.playedAt - b.game.playedAt || (a.game.id < b.game.id ? -1 : a.game.id > b.game.id ? 1 : 0));
    const withMoves = usable.filter((u) => u.analysis.moves.length > 0);
    excluded.notAnalysed += usable.length - withMoves.length;
    usable = withMoves;
  }
  const ready = usable.length >= MINIMUM_GAMES;
  return {
    gamesTotal,
    used: ready ? usable : [],
    excluded,
    analysed: usable.length,
    minimum: MINIMUM_GAMES,
    ready,
    needed: Math.max(0, MINIMUM_GAMES - usable.length),
  };
}
