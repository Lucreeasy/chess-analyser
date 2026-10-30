/**
 * Win% (0-100) from a centipawn score, from the point of view of the side the
 * score belongs to. docs/02-ANALYSIS-SPEC.md section 3.
 */
export function winPercentFromCp(cp: number): number {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * ((2 / (1 + Math.exp(-0.00368208 * c))) - 1);
}

export interface EngineLine {
  cp?: number;
  mate?: number;
}

/**
 * Win% of an engine line (White's point of view, since engine scores are
 * stored from White's point of view). section 3.
 */
export function winPercentOfLine(line: EngineLine): number {
  if (line.mate !== undefined) {
    return winPercentFromCp(line.mate > 0 ? 1000 : -1000);
  }
  return winPercentFromCp(line.cp ?? 0);
}

/** A line is a forced mate for `colour` when it carries a non-zero mate score of the matching sign. */
export function isForcedMateFor(line: EngineLine, colour: "w" | "b"): boolean {
  if (line.mate === undefined || line.mate === 0) return false;
  return colour === "w" ? line.mate > 0 : line.mate < 0;
}
