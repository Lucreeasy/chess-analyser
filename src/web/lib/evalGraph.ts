import type { MoveClass } from "../../server/analysis/classification.ts";

/** docs/06-GAMES-SPEC.md section B4 "Eval graph". */

export interface GraphDot {
  ply: number;
  winPercent: number;
  cls: MoveClass;
  shape: "diamond" | "round";
}

// docs/06-GAMES-SPEC.md section B4: which classes get a dot, and its shape.
const DOT_SHAPES: Partial<Record<MoveClass, "diamond" | "round">> = {
  brilliant: "diamond",
  great: "diamond",
  mistake: "round",
  miss: "round",
  blunder: "round",
};

export function dotsFor(winPercents: (number | undefined)[], classifications: (MoveClass | undefined)[]): GraphDot[] {
  const dots: GraphDot[] = [];
  for (let ply = 0; ply < classifications.length; ply++) {
    const cls = classifications[ply];
    const winPercent = winPercents[ply];
    const shape = cls && DOT_SHAPES[cls];
    if (shape && winPercent !== undefined) dots.push({ ply, winPercent, cls: cls!, shape });
  }
  return dots;
}

/** x position (0..width) -> the nearest ply, clamped to 0..N. */
export function nearestPly(x: number, width: number, plyCount: number): number {
  if (width <= 0 || plyCount <= 0) return 0;
  return Math.max(0, Math.min(plyCount, Math.round((x / width) * plyCount)));
}

/** The slider's value text. */
export function sliderValueText(ply: number, plyCount: number, winPercent: number | undefined): string {
  if (ply === 0) return "Start position";
  const whitePercent = winPercent === undefined ? undefined : Math.round(winPercent);
  return whitePercent === undefined ? `Move ${ply}, ply ${ply} of ${plyCount}` : `Move ${ply}, ply ${ply} of ${plyCount}, White ${whitePercent}%`;
}

/** The hidden text alternative for assistive tech. */
export function accessibleSummary(winPercents: (number | undefined)[], classifications: (MoveClass | undefined)[]): string {
  const known = winPercents
    .map((w, ply) => ({ ply, w }))
    .filter((e): e is { ply: number; w: number } => e.w !== undefined);
  if (known.length === 0) return "No evaluation yet.";

  const N = winPercents.length - 1;
  const first = known[0]!;
  const last = known[known.length - 1]!;
  const firstLabel = first.ply === 0 ? "the start" : `move ${first.ply}`;
  const lastLabel = last.ply === 0 ? "the start" : `move ${last.ply}`;
  let text = `White's winning chances over ${N} plies: ${Math.round(first.w)}% at ${firstLabel}, ${Math.round(last.w)}% at ${lastLabel}.`;

  const lowest = known.reduce((a, b) => (b.w < a.w ? b : a));
  const highest = known.reduce((a, b) => (b.w > a.w ? b : a));
  const lowestLabel = lowest.ply === 0 ? "the start" : `move ${lowest.ply}`;
  const highestLabel = highest.ply === 0 ? "the start" : `move ${highest.ply}`;
  text += ` Lowest ${Math.round(lowest.w)}% at ${lowestLabel}, highest ${Math.round(highest.w)}% at ${highestLabel}.`;

  const counts = { blunder: 0, mistake: 0, miss: 0 };
  for (const cls of classifications) {
    if (cls === "blunder" || cls === "mistake" || cls === "miss") counts[cls]++;
  }
  if (counts.blunder + counts.mistake + counts.miss > 0) {
    const blunders = `${counts.blunder} blunder${counts.blunder === 1 ? "" : "s"}`;
    const mistakes = `${counts.mistake} mistake${counts.mistake === 1 ? "" : "s"}`;
    const misses = `${counts.miss} miss${counts.miss === 1 ? "" : "es"}`;
    text += ` ${blunders}, ${mistakes}, ${misses}.`;
  }
  return text;
}
