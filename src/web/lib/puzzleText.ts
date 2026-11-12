import { TAG_INFO, annotatedSan } from "../../server/analysis/texts.ts";
import type { MoveClass } from "../../server/analysis/classification.ts";
import type { TacticTag } from "../../server/analysis/tacticTags.ts";
import type { Phase } from "../../server/analysis/phases.ts";
import { plural, ukDate } from "./format.ts";

/** Wording of the Puzzles screen. */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const unit = (n: number, word: string) => `in ${plural(n, word)}`;

/** "now", "in 20 minutes", "in 5 hours", "in 2 days" until `at`; singular exactly for 1. */
export function relativeTime(at: number, now: number): string {
  const d = at - now;
  if (d <= 0) return "now";
  if (d < HOUR) return unit(Math.max(1, Math.round(d / MINUTE)), "minute");
  if (d < DAY) {
    const hours = Math.round(d / HOUR);
    return hours >= 24 ? unit(1, "day") : unit(hours, "hour");
  }
  return unit(Math.round(d / DAY), "day");
}

/** The sentence after an answer that says when the puzzle comes back. */
export function scheduleNote(a: { correct: boolean; retired: boolean; dueAt?: number; intervalDays: number }, now: number): string {
  if (a.retired) return a.correct ? "This puzzle is done and will not come back." : "This puzzle is retired.";
  if (a.dueAt === undefined) return "";
  const when = a.intervalDays === 1 ? "tomorrow" : relativeTime(a.dueAt, now);
  return a.correct ? `Solved. Next review ${when}.` : `It will come back ${when} (${plural(a.intervalDays, "day")}).`;
}

/** "23. Nxe5??" for White, "23... Nxe5??" for Black, from the puzzle position (side to move, move number). */
export function moveLabel(fen: string, san: string, cls: MoveClass): string {
  const [, side, , , , number] = fen.split(" ");
  return `${number}${side === "w" ? "." : "..."} ${annotatedSan(san, cls)}`;
}

/** "vs rival · 31 Jan 2024 · your move 26. Rxd5? · Positional · Middlegame" */
export function provenance(p: {
  opponent?: string;
  playedAt: number;
  fen: string;
  playedSan: string;
  playedClass: MoveClass;
  tag?: TacticTag;
  phase: Phase;
}): string {
  return [
    p.opponent && `vs ${p.opponent}`,
    ukDate(p.playedAt),
    `your move ${moveLabel(p.fen, p.playedSan, p.playedClass)}`,
    p.tag && TAG_INFO[p.tag].label,
    p.phase[0].toUpperCase() + p.phase.slice(1),
  ]
    .filter(Boolean)
    .join(" · ");
}
