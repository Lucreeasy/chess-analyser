import { epdOf, lookupOpening, BOOK_DEPTH } from "../analysis/book.ts";

/** Opening classification by position-chain matching. docs/03-IMPORT-SPEC.md section 2.14. */

export interface OpeningInfo {
  eco?: string;
  openingName?: string;
  openingFamily?: string;
}

/**
 * `fens` are the positions after each ply, in order, for a game that starts
 * from the standard position (section 2.6); `isStandardStart` is false for
 * games from a given FEN, which only keep the ECO tag (rule 6).
 */
export function classifyOpening(fens: string[], isStandardStart: boolean, ecoTag: string | undefined): OpeningInfo {
  if (isStandardStart) {
    for (let i = Math.min(fens.length, BOOK_DEPTH) - 1; i >= 0; i--) {
      const hit = lookupOpening(epdOf(fens[i]));
      if (hit) return { eco: hit.eco, openingName: hit.name, openingFamily: hit.family };
    }
  }
  return ecoTag ? { eco: ecoTag } : {};
}
