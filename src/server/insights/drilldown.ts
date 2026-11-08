/**
 * The game lists behind the numbers. docs/04-INSIGHTS-SPEC.md section 15.1.
 */
import { ERROR_CLASSES, isError } from "../analysis/classification.ts";
import { ALL_PHASES } from "../analysis/phases.ts";
import { isPunished, myMoves, opportunities } from "./overview.ts";
import type { Openings } from "./openings.ts";
import type { Outcome, Tilt } from "./conversion.ts";
import type { TimeStats } from "./time.ts";
import { MAX_IDS, type UsedGame } from "./select.ts";



export interface GameList {
  total: number;
  /** At most 500: highest weight first (weighted lists), then newest. */
  ids: string[];
}

export interface ListSources {
  openings: Openings;
  conversion: Outcome;
  resilience: Outcome;
  time: TimeStats;
  tilt: Tilt;
}

export function drilldownLists(used: UsedGame[], sources: ListSources): Record<string, GameList> {
  const order = new Map(used.map((u, i) => [u, i]));
  const entries = new Map<string, Map<UsedGame, number>>();
  /** Adds a game to a list; a weight of 0 adds nothing. Unweighted lists use weight 1 throughout. */
  const add = (key: string, u: UsedGame, weight = 1) => {
    if (weight <= 0) return;
    if (!entries.has(key)) entries.set(key, new Map());
    entries.get(key)!.set(u, weight);
  };
  const addAll = (key: string, games: UsedGame[]) => games.forEach((u) => add(key, u));

  for (const u of used) {
    add("all", u);
    add(`color:${u.me}`, u);
    add(`timeClass:${u.game.timeClass}`, u);
    const mine = myMoves(u);
    const errors = mine.filter((m) => isError(m.classification));
    add("error:all", u, errors.length);
    for (const c of ERROR_CLASSES) add(`error:${c}`, u, errors.filter((m) => m.classification === c).length);
    for (const p of ALL_PHASES) {
      add(`phase:${p}`, u, mine.some((m) => m.phase === p) ? 1 : 0);
      const inPhase = errors.filter((m) => m.phase === p);
      add(`error:all:${p}`, u, inPhase.length);
      for (const c of ERROR_CLASSES) add(`error:${c}:${p}`, u, inPhase.filter((m) => m.classification === c).length);
    }
    for (const m of errors) if (m.tag) add(`tactic:${m.tag}`, u, errors.filter((e) => e.tag === m.tag).length);
    const replies = opportunities(u);
    add("punish:opportunities", u, replies.length > 0 ? 1 : 0);
    add("punish:missed", u, replies.filter((m) => !isPunished(m)).length);
    add("time:troubleBlunders", u, mine.filter((m) => m.inTimeTrouble === true && m.classification === "blunder").length);
    add("time:normalBlunders", u, mine.filter((m) => m.inTimeTrouble === false && m.classification === "blunder").length);
    if (u.game.myResult === "loss" && u.game.termination === "time") add("time:loss", u);
  }

  for (const [name, outcome] of [["conversion", sources.conversion], ["resilience", sources.resilience]] as const) {
    addAll(`${name}:reached`, outcome.reachedGames);
    for (const r of ["win", "draw", "loss"] as const) {
      addAll(`${name}:${{ win: "won", draw: "drawn", loss: "lost" }[r]}`, outcome.reachedGames.filter((u) => u.game.myResult === r));
    }
  }
  addAll("resilience:saved", sources.resilience.reachedGames.filter((u) => u.game.myResult !== "loss"));
  for (const row of [...sources.openings.white, ...sources.openings.black]) addAll(`opening:${row.family}:${row.colour}`, row.games);
  addAll("time:clocks", sources.time.clocked);
  addAll("time:trouble", sources.time.clocked.filter((u) => myMoves(u).some((m) => m.inTimeTrouble)));
  addAll("tilt:afterLoss", sources.tilt.afterLossGames);
  addAll("tilt:afterWin", sources.tilt.afterWinGames);

  return Object.fromEntries(
    [...entries].map(([key, games]) => {
      const sorted = [...games].sort(([a, wa], [b, wb]) => wb - wa || order.get(b)! - order.get(a)!);
      return [key, { total: sorted.length, ids: sorted.slice(0, MAX_IDS).map(([u]) => u.game.id) }];
    }),
  );
}
