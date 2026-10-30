import { moveAccuracy } from "./moveAccuracy.ts";

type Colour = "w" | "b";

/** Population standard deviation (divide by the count, not count - 1). */
function populationSd(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function toMoverWinPercent(whiteWinPercent: number, mover: Colour): number {
  return mover === "w" ? whiteWinPercent : 100 - whiteWinPercent;
}

/** docs/02-ANALYSIS-SPEC.md section 6.1: the window list for a game of N plies. */
function buildWindows(whiteWinPercents: number[], windowSize: number): number[][] {
  const firstLen = Math.min(windowSize, whiteWinPercents.length);
  const firstWindow = whiteWinPercents.slice(0, firstLen);
  const copies = Math.max(0, firstLen - 2);

  const windows: number[][] = [];
  for (let i = 0; i < copies; i++) windows.push(firstWindow);

  if (whiteWinPercents.length <= windowSize) {
    windows.push(whiteWinPercents.slice());
  } else {
    for (let start = 0; start + windowSize <= whiteWinPercents.length; start++) {
      windows.push(whiteWinPercents.slice(start, start + windowSize));
    }
  }
  return windows;
}

function colourAccuracy(moves: Array<{ accuracy: number; weight: number }>): number {
  if (moves.length === 0) return 100;
  const weightSum = moves.reduce((s, m) => s + m.weight, 0);
  const weightedMean = moves.reduce((s, m) => s + m.accuracy * m.weight, 0) / weightSum;
  const harmonicDenominator = moves.reduce((s, m) => s + 1 / Math.max(1, m.accuracy), 0);
  const harmonicMean = moves.length / harmonicDenominator;
  return (weightedMean + harmonicMean) / 2;
}

/**
 * Game accuracy per colour. docs/02-ANALYSIS-SPEC.md section 6.
 * `whiteWinPercents` is White's Win% at every position, start (index 0)
 * through the final position (index N), N = number of plies.
 */
export function gameAccuracy(
  whiteWinPercents: number[],
  firstMover: Colour,
): { white: number; black: number } {
  const plyCount = whiteWinPercents.length - 1;
  if (plyCount <= 0) return { white: 100, black: 100 };

  const windowSize = Math.max(2, Math.min(8, Math.floor(plyCount / 10)));
  const windows = buildWindows(whiteWinPercents, windowSize).slice(0, plyCount);

  const byColour: Record<Colour, Array<{ accuracy: number; weight: number }>> = { w: [], b: [] };
  let mover: Colour = firstMover;
  for (let ply = 1; ply <= plyCount; ply++) {
    const before = toMoverWinPercent(whiteWinPercents[ply - 1], mover);
    const after = toMoverWinPercent(whiteWinPercents[ply], mover);
    const weight = Math.max(0.5, Math.min(12, populationSd(windows[ply - 1])));
    byColour[mover].push({ accuracy: moveAccuracy(before, after), weight });
    mover = mover === "w" ? "b" : "w";
  }

  return { white: colourAccuracy(byColour.w), black: colourAccuracy(byColour.b) };
}
