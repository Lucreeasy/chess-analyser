/**
 * The whole Insights computation for one request: the query, the default range, the selection, every section
 * and the drill-down lists. docs/04-INSIGHTS-SPEC.md.
 */
import { ALL_TIME_CLASSES, type TimeClass } from "../import/timeClass.ts";
import type { PersonalResult } from "../import/players.ts";
import { opponentOf } from "../games/shared.ts";
import { defaultRange, selectGames, type DefaultRange, type GameWithAnalysis, type InsightFilters } from "./select.ts";
import { overview } from "./overview.ts";
import { openings, type OpeningRow } from "./openings.ts";
import { timeStats } from "./time.ts";
import { conversion, tilt, type Outcome } from "./conversion.ts";
import { trend } from "./trend.ts";
import { styleFeatures } from "./style.ts";
import { playstyle } from "./playstyle.ts";
import { recommendations } from "./recommendations.ts";
import { drilldownLists, MAX_IDS } from "./drilldown.ts";

export interface InsightsQuery {
  filters: InsightFilters;
  /** "All time" chosen explicitly: no default range. */
  allTime: boolean;
}

const RESULTS: PersonalResult[] = ["win", "loss", "draw"];

/** Reads the query string: lists are comma-separated, dates are ms since the epoch; unknown values are dropped. */
export function parseInsightsQuery(params: URLSearchParams): InsightsQuery {
  const list = (name: string) => params.get(name)?.split(",").filter(Boolean);
  const time = (name: string) => {
    const value = Number(params.get(name) ?? NaN);
    return Number.isFinite(value) ? value : undefined;
  };
  const colour = params.get("colour");
  const ids = list("ids");
  return {
    filters: {
      timeClasses: list("timeClass")?.filter((c): c is TimeClass => (ALL_TIME_CLASSES as readonly string[]).includes(c)),
      colour: colour === "w" || colour === "b" ? colour : undefined,
      results: list("result")?.filter((r): r is PersonalResult => (RESULTS as string[]).includes(r)),
      family: params.get("family") ?? undefined,
      from: time("from"),
      to: time("to"),
      ids: ids && [...new Set(ids)].slice(0, MAX_IDS),
    },
    allTime: params.get("allTime") === "1",
  };
}

const withoutGames = ({ reachedGames, ...rest }: Outcome) => rest;
const openingRow = ({ games, ...rest }: OpeningRow) => ({ ...rest, games: games.length, list: `opening:${rest.family}:${rest.colour}` });

export function computeInsights(games: GameWithAnalysis[], query: InsightsQuery, now: number) {
  const families = [...Map.groupBy(games.filter((g) => g.game.openingFamily), (g) => g.game.openingFamily!)]
    .map(([name, gs]) => ({ name, count: gs.length }))
    .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1));
  const library = { families, hasClassical: games.some((g) => g.game.timeClass === "classical") };

  const explicitDates = query.filters.from !== undefined || query.filters.to !== undefined;
  const range: DefaultRange | undefined = explicitDates || query.allTime ? undefined : defaultRange(games, query.filters, now);
  const filters = range?.from === undefined ? query.filters : { ...query.filters, from: range.from };

  const selection = selectGames(games, filters);
  const { used, ...counts } = selection;
  const base = { ...counts, defaultRange: range, filters, library };
  if (!selection.ready) return { ...base, ready: false as const };

  const o = overview(used);
  const op = openings(used);
  const t = timeStats(used);
  const { conversion: conv, resilience } = conversion(used);
  const ti = tilt(used);
  const style = styleFeatures(used);
  const recs = recommendations({ used, overview: o, time: t, conversion: conv, tilt: ti, openings: op });
  const byId = new Map(used.map((u, i) => [u.game.id, { opponent: opponentOf(u.game), index: i + 1 }]));

  return {
    ...base,
    ready: true as const,
    overview: o,
    openings: { white: op.white.map(openingRow), black: op.black.map(openingRow), unnamed: op.unnamed },
    time: { ...t, clocked: t.clocked.length },
    conversion: withoutGames(conv),
    resilience: withoutGames(resilience),
    tilt: { afterLoss: ti.afterLoss, afterWin: ti.afterWin },
    trend: trend(used),
    playstyle: playstyle({
      ...style,
      accuracy: o.accuracy,
      conversion: conv.rate,
      endgameAccuracy: o.accuracyByPhase.endgame,
      gamesInTrouble: t.gamesInTrouble,
      troubleBlunders: t.troubleBlunders,
    }),
    recommendations: recs.map((r) => ({ ...r, evidence: r.evidence.map((e) => ({ ...e, ...byId.get(e.gameId) })) })),
    lists: drilldownLists(used, { openings: op, conversion: conv, resilience, time: t, tilt: ti }),
  };
}
