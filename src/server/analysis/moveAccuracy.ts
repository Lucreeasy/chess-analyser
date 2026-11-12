/**
 * Move accuracy. Inputs are mover Win% before/after (0-100). The "uncertainty bonus" of 1 point is
 * always on.
 */
export function moveAccuracy(before: number, after: number): number {
  if (after >= before) return 100;
  const d = before - after;
  const bonus = 1;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * d) - 3.166924740191411 + bonus;
  return Math.max(0, Math.min(100, raw));
}
