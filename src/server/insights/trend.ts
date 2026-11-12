/**
 * Rolling accuracy over a window of 20 games.
 */
import { mean } from "./overview.ts";
import type { UsedGame } from "./select.ts";

const WINDOW = 20;
const FIRST_POINT = 5;
const MAX_POINTS = 300;

export interface TrendPoint {
  /** 1-based position of the window's newest game in play order. */
  k: number;
  gameId: string;
  playedAt: number;
  n: number;
  accuracy: number;
  rating?: number;
  from: number;
  to: number;
}

export function trend(used: UsedGame[]): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let k = FIRST_POINT; k <= used.length; k++) {
    const window = used.slice(Math.max(0, k - WINDOW), k);
    const ratings = window
      .map((u) => (u.me === "w" ? u.game.whiteElo : u.game.blackElo))
      .filter((r) => r !== undefined);
    points.push({
      k,
      gameId: used[k - 1].game.id,
      playedAt: used[k - 1].game.playedAt,
      n: window.length,
      accuracy: mean(window.map((u) => u.analysis.summary.accuracy[u.me])).value!,
      rating: mean(ratings).value,
      from: window[0].game.playedAt,
      to: window[window.length - 1].game.playedAt,
    });
  }
  if (points.length <= MAX_POINTS) return points;
  return Array.from({ length: MAX_POINTS }, (_, j) => points[Math.round((j * (points.length - 1)) / (MAX_POINTS - 1))]);
}
