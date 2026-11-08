import type { GameList } from "../../server/insights/drilldown.ts";
import type { InsightFilters } from "../../server/insights/select.ts";
import { plural, thousands } from "./format.ts";

/** Ids travel in the link, so only short lists are linked exactly. docs/04-INSIGHTS-SPEC.md section 15.2. */
const MAX_LINKED_IDS = 300;

export interface DrillLink {
  href: string;
  /** The screen-reader sentence (and tooltip) of section 15.2. */
  hint: string;
}

const KEYS: Record<string, (f: InsightFilters) => string | undefined> = {
  timeClass: (f) => f.timeClasses?.join(","),
  colour: (f) => f.colour,
  result: (f) => f.results?.join(","),
  family: (f) => f.family,
  from: (f) => f.from?.toString(),
  to: (f) => f.to?.toString(),
};

/**
 * Section 15.2: the link behind a number, or undefined when no games are behind it. `exact` says the filters
 * describe the list exactly (e.g. "all"); otherwise a filter-only link is marked approximate.
 */
export function drillLink(list: GameList | undefined, label: string, filters: InsightFilters, exact = false): DrillLink | undefined {
  if (!list || list.total === 0) return undefined;
  const params = new URLSearchParams();
  const exactHint = `Show the ${plural(list.total, "game")} behind this number`;
  if (list.ids.length === list.total && list.ids.length <= MAX_LINKED_IDS) {
    params.set("ids", list.ids.join(","));
    params.set("label", label);
    return { href: `#/games?${params}`, hint: exactHint };
  }
  for (const [key, read] of Object.entries(KEYS)) {
    const value = read(filters);
    if (value) params.set(key, value);
  }
  params.set("analysis", "analysed");
  params.set("label", label);
  if (!exact) params.set("approx", "1");
  return {
    href: `#/games?${params}`,
    hint: exact ? exactHint : `Show games matching the filters (the exact list of ${thousands(list.total)} is too long to link)`,
  };
}
