/**
 * The playstyle radar: percentiles against club players, five axes, their explanations and the archetype.
 * docs/04-INSIGHTS-SPEC.md section 12.
 */
import type { Stat } from "./overview.ts";

export type AxisKey = "aggression" | "sharpness" | "precision" | "technique" | "clock";
type Unit = "perMove" | "share" | "per100" | "winPoints" | "accuracy";

/** Section 12.2: each input's label, unit, club-player band (p10, p25, p50, p75, p90) and direction. */
interface InputSpec {
  label: string;
  unit: Unit;
  band: [number, number, number, number, number];
  inverted?: boolean;
}

export interface AxisInput {
  label: string;
  unit: Unit;
  raw?: number;
  /** Rounded to one decimal; absent when the input has no data. */
  percentile?: number;
  inverted: boolean;
}

export interface Axis {
  key: AxisKey;
  label: string;
  short: string;
  /** Rounded to one decimal; absent ("no data") when no input counts. */
  value?: number;
  inputs: AxisInput[];
  explanation: string;
}

export interface Archetype {
  label: string;
  description: string;
  weakest: AxisKey;
  /** The two highest axes, highest first; absent for "Balanced all-rounder". */
  pair?: [AxisKey, AxisKey];
}

/** The raw values the radar reads, by input label. */
export interface PlaystyleInputs {
  checksCaptures: Stat;
  opponentHalf: Stat;
  pawnStorm: Stat;
  oppositeCastling: Stat;
  volatility: Stat;
  accuracy: Stat;
  bestMoveRate: Stat;
  conversion: Stat;
  endgameAccuracy: Stat;
  gamesInTrouble: Stat;
  troubleBlunders: Stat;
}

const AXES: { key: AxisKey; label: string; short: string; high: string; low: string; inputs: [keyof PlaystyleInputs, InputSpec][] }[] = [
  {
    key: "aggression",
    label: "Aggression",
    short: "Aggression",
    high: "You attack: lots of checks and captures, pieces and pawns pushed at the enemy king.",
    low: "You play quietly: few checks and captures, little pressure on the enemy king.",
    inputs: [
      ["checksCaptures", { label: "Checks + captures per move", unit: "perMove", band: [0.14, 0.19, 0.25, 0.31, 0.38] }],
      ["opponentHalf", { label: "Moves landing in the opponent half", unit: "share", band: [0.28, 0.34, 0.4, 0.46, 0.53] }],
      ["pawnStorm", { label: "Pawn advances toward the enemy king", unit: "share", band: [0.01, 0.02, 0.04, 0.06, 0.09] }],
      ["oppositeCastling", { label: "Opposite-side castling", unit: "share", band: [0, 0.05, 0.12, 0.2, 0.3] }],
    ],
  },
  {
    key: "sharpness",
    label: "Sharpness",
    short: "Sharpness",
    high: "Your games swing: the evaluation jumps around, so the positions you steer into are volatile.",
    low: "Your games are calm: the evaluation stays steady, with few tactical fireworks.",
    inputs: [["volatility", { label: "Win% volatility (10-ply windows)", unit: "winPoints", band: [4, 6, 8, 11, 14] }]],
  },
  {
    key: "precision",
    label: "Precision",
    short: "Precision",
    high: "You find accurate moves, and often the engine move.",
    low: "Many of your moves give up value compared with the best one.",
    inputs: [
      ["accuracy", { label: "Overall accuracy", unit: "accuracy", band: [58, 66, 74, 81, 87] }],
      ["bestMoveRate", { label: "Best-move rate", unit: "share", band: [0.22, 0.3, 0.38, 0.47, 0.56] }],
    ],
  },
  {
    key: "technique",
    label: "Technique",
    short: "Technique",
    high: "You turn good positions into wins and handle endgames well.",
    low: "Winning positions slip away and endgames cost you points.",
    inputs: [
      ["conversion", { label: "Conversion rate", unit: "share", band: [0.5, 0.6, 0.7, 0.8, 0.88] }],
      ["endgameAccuracy", { label: "Endgame accuracy", unit: "accuracy", band: [50, 58, 66, 75, 84] }],
    ],
  },
  {
    key: "clock",
    label: "Clock discipline",
    short: "Clock",
    high: "You rarely run low on time and your moves stay sound when you do.",
    low: "You often run low on time, and blunders pile up when you do.",
    inputs: [
      ["gamesInTrouble", { label: "Games that enter time trouble", unit: "share", band: [0.05, 0.15, 0.3, 0.5, 0.7], inverted: true }],
      ["troubleBlunders", { label: "Blunders per 100 moves in time trouble", unit: "per100", band: [1.5, 3, 5, 8, 12], inverted: true }],
    ],
  },
];

/** Section 12.6: the unordered pair of the two highest axes, keyed in axis order. */
const ARCHETYPES: Record<string, [string, string]> = {
  "aggression+sharpness": ["Sharp tactician", "You attack and complicate: games are decided by tactics, often yours."],
  "aggression+precision": ["Precise attacker", "You go for the king and still find the accurate moves while doing it."],
  "aggression+technique": ["Ruthless finisher", "You build pressure and then convert it into full points."],
  "aggression+clock": ["Disciplined attacker", "You attack with a plan and keep enough time on the clock to carry it out."],
  "sharpness+precision": ["Sharp calculator", "You thrive in volatile positions and calculate them accurately."],
  "sharpness+technique": ["Counter-puncher", "You are at home in messy games and cash in on the chances that come your way."],
  "sharpness+clock": ["Composed fighter", "You accept chaos on the board but stay calm and on time."],
  "precision+technique": ["Solid grinder", "You play clean moves, win the better positions and squeeze endgames."],
  "precision+clock": ["Metronome", "You play steady, accurate chess at a steady pace, rarely rushed."],
  "technique+clock": ["Patient closer", "You take your time, keep the position under control and close games out."],
};
const BALANCED: [string, string] = ["Balanced all-rounder", "No single strength stands out: your five axes are close together."];
const BALANCED_SPREAD = 15;

const PERCENTILES = [10, 25, 50, 75, 90];

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Section 12.1: linear between breakpoints, extended past the ends, flat segments as steps, clamped. */
export function percentile(raw: number, band: number[], inverted = false): number {
  let p: number;
  const [b, P] = [band, PERCENTILES];
  if (raw < b[0]) p = b[1] === b[0] ? 0 : P[0] + ((raw - b[0]) * (P[1] - P[0])) / (b[1] - b[0]);
  else if (raw > b[4]) p = b[4] === b[3] ? 100 : P[4] + ((raw - b[4]) * (P[4] - P[3])) / (b[4] - b[3]);
  else {
    const i = [3, 2, 1, 0].find((j) => raw >= b[j])!;
    p = raw >= b[i + 1] ? P[i + 1] : P[i] + ((raw - b[i]) * (P[i + 1] - P[i])) / (b[i + 1] - b[i]);
  }
  p = Math.min(100, Math.max(0, p));
  return inverted ? 100 - p : p;
}

export function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** Section 12.4's raw formats inside the explanation sentence. */
function sentenceRaw(raw: number, unit: Unit): string {
  switch (unit) {
    case "share":
      return `${Math.round(raw * 100)}%`;
    case "perMove":
      return `${raw.toFixed(2)} per move`;
    case "per100":
      return `${raw.toFixed(1)} per 100 moves`;
    case "winPoints":
      return `${raw.toFixed(1)} Win% points`;
    case "accuracy":
      return raw.toFixed(1);
  }
}

export function playstyle(inputs: PlaystyleInputs): { axes: Axis[]; archetype?: Archetype } {
  const axes = AXES.map((spec): Axis => {
    const counted: number[] = [];
    const parts: string[] = [];
    const axisInputs = spec.inputs.map(([key, input]): AxisInput => {
      const { value, n } = inputs[key];
      if (value === undefined || n === 0 || !Number.isFinite(value)) return { label: input.label, unit: input.unit, inverted: !!input.inverted };
      const p = percentile(value, input.band, input.inverted);
      counted.push(p);
      parts.push(
        `${input.label.toLowerCase()} ${sentenceRaw(value, input.unit)} (${input.inverted ? "better" : "higher"} than ${ordinal(Math.round(p))} percentile of club players)`,
      );
      return { label: input.label, unit: input.unit, raw: value, percentile: round1(p), inverted: !!input.inverted };
    });
    const value = counted.length ? round1(counted.reduce((a, b) => a + b, 0) / counted.length) : undefined;
    const meaning = value === undefined ? "" : value >= 60 ? spec.high : value <= 40 ? spec.low : "Around the club average.";
    return {
      key: spec.key,
      label: spec.label,
      short: spec.short,
      value,
      inputs: axisInputs,
      explanation: value === undefined ? `${spec.label}: not enough data yet.` : `${meaning} Based on ${parts.join("; ")}.`,
    };
  });

  const ranked = axes.filter((a) => a.value !== undefined).sort((a, b) => b.value! - a.value!);
  if (ranked.length < 2) return { axes };
  const weakest = ranked[ranked.length - 1].key;
  if (round1(ranked[0].value! - ranked[ranked.length - 1].value!) < BALANCED_SPREAD) {
    return { axes, archetype: { label: BALANCED[0], description: BALANCED[1], weakest } };
  }
  const pair: [AxisKey, AxisKey] = [ranked[0].key, ranked[1].key];
  const order = AXES.map((a) => a.key);
  const key = [...pair].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join("+");
  const [label, description] = ARCHETYPES[key];
  return { axes, archetype: { label, description, weakest, pair } };
}
