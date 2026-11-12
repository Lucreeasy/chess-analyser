/**
 * Converting winning positions, saving losing ones, and accuracy right after a loss or a win.
 */
import { mean, share, type Stat } from "./overview.ts";
import type { UsedGame } from "./select.ts";

const WINNING_EP = 0.8;
const LOSING_EP = 0.2;
const SESSION_GAP_MS = 2 * 3_600_000;

export interface Outcome {
  /** Games with a result that reached the position, in play order. */
  reachedGames: UsedGame[];
  /** n = games with a result. */
  reached: Stat;
  /** Conversion: won / reached; resilience: won or drawn / reached. */
  rate: Stat;
  won: Stat;
  drawn: Stat;
  lost: Stat;
}

export interface Tilt {
  /** The games played right after a loss / a win (the following games). */
  afterLossGames: UsedGame[];
  afterWinGames: UsedGame[];
  afterLoss: Stat;
  afterWin: Stat;
}

function outcome(decided: UsedGame[], reachedIt: (u: UsedGame) => boolean, savedCounts: (r: string) => boolean): Outcome {
  const reachedGames = decided.filter(reachedIt);
  const count = (r: string) => reachedGames.filter((u) => u.game.myResult === r).length;
  return {
    reachedGames,
    reached: share(reachedGames.length, decided.length),
    rate: share(reachedGames.filter((u) => savedCounts(u.game.myResult!)).length, reachedGames.length),
    won: share(count("win"), reachedGames.length),
    drawn: share(count("draw"), reachedGames.length),
    lost: share(count("loss"), reachedGames.length),
  };
}

export function conversion(used: UsedGame[]): { conversion: Outcome; resilience: Outcome } {
  const decided = used.filter((u) => u.game.myResult !== undefined);
  return {
    conversion: outcome(decided, (u) => u.analysis.summary.maxEp[u.me] >= WINNING_EP, (r) => r === "win"),
    resilience: outcome(decided, (u) => u.analysis.summary.minEp[u.me] <= LOSING_EP, (r) => r !== "loss"),
  };
}

/** Consecutive used games (play order) started at most 2 hours apart. */
export function tilt(used: UsedGame[]): Tilt {
  const afterLossGames: UsedGame[] = [];
  const afterWinGames: UsedGame[] = [];
  for (let i = 1; i < used.length; i++) {
    const [previous, current] = [used[i - 1].game, used[i]];
    if (current.game.playedAt - previous.playedAt > SESSION_GAP_MS) continue;
    if (previous.myResult === "loss") afterLossGames.push(current);
    if (previous.myResult === "win") afterWinGames.push(current);
  }
  const accuracy = (games: UsedGame[]) => mean(games.map((u) => u.analysis.summary.accuracy[u.me]));
  return { afterLossGames, afterWinGames, afterLoss: accuracy(afterLossGames), afterWin: accuracy(afterWinGames) };
}
