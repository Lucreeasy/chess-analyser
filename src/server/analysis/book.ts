import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface OpeningEntry {
  eco: string;
  name: string;
  family: string;
}

type RawBook = Record<string, [eco: string, name: string]>;

const dataPath = fileURLToPath(new URL("../data/openings.json", import.meta.url));
const raw: RawBook = JSON.parse(readFileSync(dataPath, "utf8"));

const book = new Map<string, OpeningEntry>();
for (const [epd, [eco, name]] of Object.entries(raw)) {
  book.set(epd, { eco, name, family: name.includes(":") ? name.slice(0, name.indexOf(":")).trim() : name });
}

/**
 * How many plies of position-chain matching (the import's opening lookup) are
 * needed to reach every named position: this dataset's deepest entry is at
 * ply 36.
 */
export const BOOK_DEPTH = 36;

/** The EPD of a FEN: the first four fields (placement, side, castling, en-passant). */
export function epdOf(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

/** Is this EPD a known opening position? */
export function isInBook(epd: string): boolean {
  return book.has(epd);
}

/** The opening entry for an EPD, if any. */
export function lookupOpening(epd: string): OpeningEntry | undefined {
  return book.get(epd);
}
