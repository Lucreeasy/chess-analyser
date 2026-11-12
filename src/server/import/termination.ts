import { Chess } from "chess.js";

/** Termination, normalised to a short label. */

const RULES: Array<[RegExp, string]> = [
  [/abandon/, "abandoned"],
  [/insufficient material/, "insufficient material"],
  [/50-move|50 move|50move/, "50-move rule"],
  [/repetition/, "repetition"],
  [/stalemate/, "stalemate"],
  [/agree/, "agreement"],
  [/checkmate/, "checkmate"],
  [/resign/, "resignation"],
  [/on time|timeout|time forfeit|\btime\b/, "time"],
];

/**
 * Normalises the Termination tag; without one (or blank), falls back to the
 * final board position (only meaningful after a full replay).
 */
export function normalizeTermination(tagValue: string | undefined, finalFen?: string): string | undefined {
  const trimmed = (tagValue ?? "").trim();
  if (trimmed === "") {
    if (!finalFen) return undefined;
    const chess = new Chess(finalFen);
    if (chess.isCheckmate()) return "checkmate";
    if (chess.isStalemate()) return "stalemate";
    return undefined;
  }

  // A leading "{name} won/lost/resigned" is the player's name, not part of the reason.
  const withoutPrefix = trimmed.replace(/^\S+\s+(?=won\b|lost\b|resigned\b)/i, "");
  const text = withoutPrefix.toLowerCase();
  for (const [pattern, label] of RULES) {
    if (pattern.test(text)) return label;
  }
  return trimmed;
}
