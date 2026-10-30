/**
 * Expected points (EP) and EP loss. docs/02-ANALYSIS-SPEC.md section 4.
 * EP is always from the mover's point of view; Win% is stored White POV.
 */

/** Converts a White-POV Win% into the mover's EP (0-1). */
export function moverEp(whiteWinPercent: number, mover: "w" | "b"): number {
  const moverWinPercent = mover === "w" ? whiteWinPercent : 100 - whiteWinPercent;
  return moverWinPercent / 100;
}

/** EP loss = max(0, EP before - EP after), no tolerance. */
export function epLoss(epBefore: number, epAfter: number): number {
  return Math.max(0, epBefore - epAfter);
}
