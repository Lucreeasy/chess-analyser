/** Clamping the ply in the Review screen's address. docs/06-GAMES-SPEC.md section B1: "Missing, non-numeric -> ply 0 (start position); out-of-range values are clamped to 0..number of plies". */
export function clampPly(ply: number, plyCount: number): number {
  if (!Number.isFinite(ply)) return 0;
  return Math.max(0, Math.min(ply, plyCount));
}
