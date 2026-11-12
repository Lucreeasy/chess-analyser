/**
 * What the Puzzles screen asks for: the ordered list (Due or All), counts, filter facets and the next due time.
 */
import { ALL_TAGS, type TacticTag } from "../analysis/tacticTags.ts";
import { ALL_PHASES, type Phase } from "../analysis/phases.ts";
import type { Puzzle } from "./store.ts";

export type TagKey = TacticTag | "none";

export interface ListQuery {
  mode: "due" | "all";
  tag?: TagKey;
  phase?: Phase;
  /** Items wanted; 0 = counts and facets only. */
  limit: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Reads the query string; anything invalid is an error message. */
export function parseListQuery(params: URLSearchParams): ListQuery | string {
  const mode = params.get("mode") ?? "due";
  const tag = params.get("tag") ?? undefined;
  const phase = params.get("phase") ?? undefined;
  const limit = params.has("limit") ? Number(params.get("limit")) : DEFAULT_LIMIT;
  if (mode !== "due" && mode !== "all") return `mode must be "due" or "all"`;
  if (tag !== undefined && tag !== "none" && !(ALL_TAGS as string[]).includes(tag)) return `unknown tag "${tag}"`;
  if (phase !== undefined && !(ALL_PHASES as string[]).includes(phase)) return `unknown phase "${phase}"`;
  if (!Number.isInteger(limit) || limit < 0) return "limit must be a non-negative integer";
  return { mode, tag: tag as TagKey | undefined, phase: phase as Phase | undefined, limit: Math.min(limit, MAX_LIMIT) };
}

/** Due now: never attempted, or attempted and due at or before now; retired puzzles (no due time) never are. */
export const isDue = (p: Puzzle, now: number) => p.attempts === 0 || (p.dueAt !== undefined && p.dueAt <= now);

/** 1 reviews due, 2 new, 3 waiting, 4 retired. */
const group = (p: Puzzle, now: number) => (p.attempts === 0 ? 2 : p.dueAt === undefined ? 4 : p.dueAt <= now ? 1 : 3);

function compare(a: Puzzle, b: Puzzle, now: number): number {
  const ga = group(a, now);
  return (
    ga - group(b, now) ||
    (ga === 1 || ga === 3 ? a.dueAt! - b.dueAt! : 0) ||
    b.playedAt - a.playedAt ||
    a.ply - b.ply
  );
}

const tagOf = (p: Puzzle): TagKey => p.tag ?? "none";

/** One facet per existing key: how many puzzles, and how many of them are due. */
function facets<K>(all: Puzzle[], keyOf: (p: Puzzle) => K, now: number) {
  const map = new Map<K, { key: K; count: number; due: number }>();
  for (const p of all) {
    const f = map.get(keyOf(p)) ?? { key: keyOf(p), count: 0, due: 0 };
    f.count++;
    if (isDue(p, now)) f.due++;
    map.set(f.key, f);
  }
  return [...map.values()];
}

export function listView(all: Puzzle[], q: ListQuery, now: number) {
  const matching = all.filter((p) => (q.tag === undefined || tagOf(p) === q.tag) && (q.phase === undefined || p.phase === q.phase));
  const shown = matching.filter((p) => q.mode === "all" || isDue(p, now)).sort((a, b) => compare(a, b, now));
  const future = matching.filter((p) => p.attempts > 0 && p.dueAt !== undefined && p.dueAt > now).map((p) => p.dueAt!);
  return {
    now,
    // Never the solution or the engine line: nothing sent before an answer may give it away.
    items: shown.slice(0, q.limit).map(({ solution: _s, bestLine: _b, bestEp: _e, ...item }) => item),
    counts: {
      total: matching.length,
      due: matching.filter((p) => isDue(p, now)).length,
      solved: matching.filter((p) => p.lastResult === "solved").length,
      retired: matching.filter((p) => p.dueAt === undefined).length,
    },
    tagFacets: facets(all, tagOf, now).sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1)),
    phaseFacets: ALL_PHASES.flatMap((ph) => facets(all, (p) => p.phase, now).filter((f) => f.key === ph)),
    nextDue: future.length > 0 ? Math.min(...future) : undefined,
  };
}
