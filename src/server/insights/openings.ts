/**
 * Results by opening family and colour: score, accuracy in plies 1-20, EP at ply 20, and the flags.
 * docs/04-INSIGHTS-SPEC.md section 7.
 */
import type { Colour, GameAnalysis } from "../analysis/game.ts";
import { harmonicMeanFloored } from "../analysis/gameAccuracy.ts";
import { mean, type Stat } from "./overview.ts";
import type { UsedGame } from "./select.ts";

const EARLY_PLIES = 20;
const FLAG_MIN_GAMES = 8;

export interface OpeningRow {
  family: string;
  colour: Colour;
  /** The row's games in play order (unfinished included). */
  games: UsedGame[];
  wins: number;
  draws: number;
  losses: number;
  /** n = games with a result. */
  score: Stat;
  accuracy: Stat;
  ep20: Stat;
  flag?: "problem" | "strong";
}

export interface Openings {
  white: OpeningRow[];
  black: OpeningRow[];
  unnamed: number;
}

/** My EP (0..1) after ply 20, or after the last ply of a shorter game. */
export function ep20(analysis: GameAnalysis, me: Colour): number | undefined {
  const move = analysis.moves[Math.min(EARLY_PLIES, analysis.moves.length) - 1];
  if (!move) return undefined;
  return me === "w" ? move.winPercentAfter / 100 : 1 - move.winPercentAfter / 100;
}

function row(family: string, colour: Colour, games: UsedGame[]): OpeningRow {
  const count = (r: string) => games.filter((u) => u.game.myResult === r).length;
  const [wins, draws, losses] = [count("win"), count("draw"), count("loss")];
  const decided = wins + draws + losses;
  const score: Stat = { value: decided ? (wins + draws / 2) / decided : undefined, n: decided };
  const early = games.map((u) => harmonicMeanFloored(u.analysis.moves.filter((m) => m.colour === u.me && m.ply <= EARLY_PLIES).map((m) => m.accuracy)));
  const eps = games.map((u) => ep20(u.analysis, u.me));
  const ep = mean(eps.filter((e) => e !== undefined));
  let flag: OpeningRow["flag"];
  if (score.value !== undefined && games.length >= FLAG_MIN_GAMES) {
    if (score.value < 0.4 && ep.value !== undefined && ep.value < 0.4) flag = "problem";
    else if (score.value > 0.6) flag = "strong";
  }
  return {
    family,
    colour,
    games,
    wins,
    draws,
    losses,
    score,
    accuracy: mean(early.filter((a) => a !== undefined)),
    ep20: ep,
    flag,
  };
}

export function openings(used: UsedGame[]): Openings {
  const groups = new Map<string, UsedGame[]>();
  for (const u of used) {
    if (u.game.openingFamily === undefined) continue;
    const key = `${u.me}:${u.game.openingFamily}`;
    groups.set(key, [...(groups.get(key) ?? []), u]);
  }
  const rows = [...groups.values()]
    .map((games) => row(games[0].game.openingFamily!, games[0].me, games))
    .sort((a, b) => b.games.length - a.games.length || (a.family < b.family ? -1 : a.family > b.family ? 1 : 0));
  return {
    white: rows.filter((r) => r.colour === "w"),
    black: rows.filter((r) => r.colour === "b"),
    unnamed: used.filter((u) => u.game.openingFamily === undefined).length,
  };
}
