import type { EngineLine } from "../../server/analysis/winPercent.ts";
import { cpFromWinPercent } from "../../server/analysis/winPercent.ts";

/** `+0.8`, `-1.2`, `0.0` (pawns, one decimal, sign shown except at exactly 0.0). */
function formatCp(cp: number): string {
  const pawns = Math.round(cp / 10) / 10;
  if (pawns === 0) return "0.0";
  return `${pawns > 0 ? "+" : "-"}${Math.abs(pawns).toFixed(1)}`;
}

/** docs/06-GAMES-SPEC.md section B4: the score text of an engine line, White's point of view. */
export function scoreTextFromLine(line: EngineLine | undefined): string {
  if (!line) return "–";
  if (line.mate !== undefined && line.mate !== 0) return line.mate > 0 ? `M${line.mate}` : `-M${Math.abs(line.mate)}`;
  return formatCp(line.cp ?? 0);
}

/** The last ply's score text: recovered from Win% (no engine line exists past the end of the game). */
export function scoreTextFromWinPercent(winPercent: number): string {
  if (winPercent >= 99.99) return "1-0";
  if (winPercent <= 0.01) return "0-1";
  return formatCp(cpFromWinPercent(winPercent));
}
