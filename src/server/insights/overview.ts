/**
 * The overall numbers: accuracy, errors per 100 moves, tactic shares, punish rate and consistency, also
 * by phase. docs/04-INSIGHTS-SPEC.md section 5 (and the phase figures of section 6).
 */
import type { MoveRecord } from "../analysis/game.ts";
import { ERROR_CLASSES, isError, type ErrorClass, type MoveClass } from "../analysis/classification.ts";
import { ALL_TAGS, type TacticTag } from "../analysis/tacticTags.ts";
import { ALL_PHASES, type Phase } from "../analysis/phases.ts";
import { harmonicMeanFloored, populationSd } from "../analysis/gameAccuracy.ts";
import type { TimeClass } from "../import/timeClass.ts";
import type { UsedGame } from "./select.ts";

/** A displayed number: no value when n = 0 (shown as "–", never as 0); shares and per-100 rates carry their count. */
export interface Stat {
  value?: number;
  n: number;
  count?: number;
}

const PUNISHING: MoveClass[] = ["best", "excellent", "great", "brilliant"];

function mean(values: number[]): Stat {
  return { value: values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined, n: values.length };
}

function share(count: number, n: number): Stat {
  return { value: n ? count / n : undefined, n, count };
}

function per100(count: number, n: number): Stat {
  return { value: n ? (count / n) * 100 : undefined, n, count };
}

/** Section 5.1: pooled harmonic mean, each accuracy floored at 1. */
function harmonicAccuracy(accuracies: number[]): Stat {
  return { value: harmonicMeanFloored(accuracies), n: accuracies.length };
}

function myMoves(used: UsedGame): MoveRecord[] {
  return used.analysis.moves.filter((m) => m.colour === used.me);
}

/** Per error class and "all", per 100 of the given moves. */
function errorRates(moves: MoveRecord[]): Record<ErrorClass | "all", Stat> {
  const rates = Object.fromEntries(
    ERROR_CLASSES.map((c) => [c, per100(moves.filter((m) => m.classification === c).length, moves.length)]),
  ) as Record<ErrorClass | "all", Stat>;
  rates.all = per100(moves.filter((m) => isError(m.classification)).length, moves.length);
  return rates;
}

export interface Overview {
  games: number;
  moves: number;
  accuracy: Stat;
  accuracyByColour: Record<"w" | "b", Stat>;
  accuracyByTimeClass: Partial<Record<TimeClass, Stat>>;
  /** n = my moves in the phase. */
  accuracyByPhase: Record<Phase, Stat>;
  errors: Record<ErrorClass | "all", Stat>;
  errorsByPhase: Record<Phase, Record<ErrorClass | "all", Stat>>;
  tactics: Record<TacticTag, Stat>;
  topTag?: TacticTag;
  punish: Stat;
  missed: Stat;
  consistency: Stat;
}

export function overview(used: UsedGame[]): Overview {
  const accuracyOf = (u: UsedGame) => u.analysis.summary.accuracy[u.me];
  const all = used.flatMap(myMoves);

  const timeClasses = [...new Set(used.map((u) => u.game.timeClass))];
  const accuracyByTimeClass = Object.fromEntries(
    timeClasses.map((tc) => [tc, mean(used.filter((u) => u.game.timeClass === tc).map(accuracyOf))]),
  );

  const byPhase = (p: Phase) => all.filter((m) => m.phase === p);
  const tagged = all.filter((m) => isError(m.classification) && m.tag);
  const tagCount = (t: TacticTag) => tagged.filter((m) => m.tag === t).length;
  const topTag = ALL_TAGS.reduce<TacticTag | undefined>((top, t) => (tagCount(t) > (top ? tagCount(top) : 0) ? t : top), undefined);

  // Section 5.4: an opponent Mistake or Blunder immediately followed by my move; punished by a strong reply.
  let opportunities = 0;
  let punished = 0;
  for (const u of used) {
    const moves = u.analysis.moves;
    for (let i = 0; i + 1 < moves.length; i++) {
      const theirs = moves[i];
      const mine = moves[i + 1];
      if (theirs.colour === u.me || mine.colour !== u.me) continue;
      if (theirs.classification !== "mistake" && theirs.classification !== "blunder") continue;
      opportunities++;
      if (PUNISHING.includes(mine.classification)) punished++;
    }
  }

  const accuracies = used.map(accuracyOf);
  return {
    games: used.length,
    moves: all.length,
    accuracy: mean(accuracies),
    accuracyByColour: {
      w: mean(used.filter((u) => u.me === "w").map(accuracyOf)),
      b: mean(used.filter((u) => u.me === "b").map(accuracyOf)),
    },
    accuracyByTimeClass,
    accuracyByPhase: Object.fromEntries(ALL_PHASES.map((p) => [p, harmonicAccuracy(byPhase(p).map((m) => m.accuracy))])) as Record<Phase, Stat>,
    errors: errorRates(all),
    errorsByPhase: Object.fromEntries(ALL_PHASES.map((p) => [p, errorRates(byPhase(p))])) as Record<Phase, Record<ErrorClass | "all", Stat>>,
    tactics: Object.fromEntries(ALL_TAGS.map((t) => [t, share(tagCount(t), tagged.length)])) as Record<TacticTag, Stat>,
    topTag,
    punish: share(punished, opportunities),
    missed: share(opportunities - punished, opportunities),
    consistency: { value: accuracies.length >= 2 ? populationSd(accuracies) : undefined, n: used.length },
  };
}
