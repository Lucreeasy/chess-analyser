/**
 * Where the clock goes and what happens when it runs low. docs/04-INSIGHTS-SPEC.md section 8.
 */
import { mean, myMoves, per100, share, type Stat } from "./overview.ts";
import type { UsedGame } from "./select.ts";

const EARLY_PLIES = 20;
const QUICK_MS = 5000;
const MAX_MOVE_NUMBER = 60;

export interface TimeStats {
  /** Used games in which any of my moves has a clock or a time-spent value. */
  clocked: UsedGame[];
  secondsPerMove: Stat;
  secondsPerMoveEarly: Stat;
  under5s: Stat;
  /** Move numbers with data, ascending; n = games that have that move number. */
  byMoveNumber: { move: number; seconds: Stat }[];
  gamesInTrouble: Stat;
  troubleBlunders: Stat;
  normalBlunders: Stat;
  ratio?: number;
  /** Over all used games, clocks or not; n = my losses. */
  lostOnTime: Stat;
}

export function timeStats(used: UsedGame[]): TimeStats {
  const clocked = used.filter((u) => myMoves(u).some((m) => m.clockMs !== undefined || m.timeSpentMs !== undefined));
  const moves = clocked.flatMap(myMoves);
  const timed = moves.filter((m) => m.timeSpentMs !== undefined);
  const seconds = (ms: (number | undefined)[]) => mean(ms.map((t) => t! / 1000));

  const byNumber = new Map<number, number[]>();
  for (const m of timed) {
    const move = Math.ceil(m.ply / 2);
    if (move <= MAX_MOVE_NUMBER) byNumber.set(move, [...(byNumber.get(move) ?? []), m.timeSpentMs!]);
  }

  const inTrouble = moves.filter((m) => m.inTimeTrouble === true);
  const notInTrouble = moves.filter((m) => m.inTimeTrouble === false);
  const blunders = (ms: typeof moves) => ms.filter((m) => m.classification === "blunder").length;
  const troubleBlunders = per100(blunders(inTrouble), inTrouble.length);
  const normalBlunders = per100(blunders(notInTrouble), notInTrouble.length);

  const losses = used.filter((u) => u.game.myResult === "loss");
  return {
    clocked,
    secondsPerMove: seconds(timed.map((m) => m.timeSpentMs)),
    secondsPerMoveEarly: seconds(timed.filter((m) => m.ply <= EARLY_PLIES).map((m) => m.timeSpentMs)),
    under5s: share(timed.filter((m) => m.timeSpentMs! < QUICK_MS).length, timed.length),
    byMoveNumber: [...byNumber.entries()].sort(([a], [b]) => a - b).map(([move, ms]) => ({ move, seconds: seconds(ms) })),
    gamesInTrouble: share(clocked.filter((u) => myMoves(u).some((m) => m.inTimeTrouble)).length, clocked.length),
    troubleBlunders,
    normalBlunders,
    ratio:
      troubleBlunders.value !== undefined && normalBlunders.value ? troubleBlunders.value / normalBlunders.value : undefined,
    lostOnTime: share(losses.filter((u) => u.game.termination === "time").length, losses.length),
  };
}
