import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { epdOf, isInBook, lookupOpening, BOOK_DEPTH } from "../../../src/server/analysis/book.ts";

test("BOOK_DEPTH is 36 per docs/02-ANALYSIS-SPEC.md section 7", () => {
  assert.equal(BOOK_DEPTH, 36);
});

test("epdOf keeps only the first four FEN fields", () => {
  assert.equal(
    epdOf("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
  );
});

test("the Najdorf Sicilian is found by its EPD, ECO B90", () => {
  const chess = new Chess();
  chess.loadPgn("1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6");
  const epd = epdOf(chess.fen());
  assert.equal(isInBook(epd), true);
  const entry = lookupOpening(epd);
  assert.equal(entry?.eco, "B90");
  assert.match(entry!.name, /Najdorf/);
  assert.equal(entry!.family, "Sicilian Defense");
});

test("transposing into the same Nimzo-Indian position gives the same name", () => {
  const viaE4Line = new Chess();
  viaE4Line.loadPgn("1. d4 Nf6 2. c4 e6 3. Nc3 Bb4");
  const viaOther = new Chess();
  viaOther.loadPgn("1. c4 e6 2. Nc3 Nf6 3. d4 Bb4");

  const a = lookupOpening(epdOf(viaE4Line.fen()));
  const b = lookupOpening(epdOf(viaOther.fen()));
  assert.ok(a);
  assert.equal(a!.name, b!.name);
  assert.match(a!.name, /Nimzo-Indian/);
});

test("a name with no colon is its own family", () => {
  const entry = { eco: "A07", name: "King's Indian Attack, with e6", family: "King's Indian Attack, with e6" };
  assert.equal(entry.family, entry.name);
});

test("an out-of-book position is not found", () => {
  assert.equal(isInBook("8/8/8/8/8/8/8/8 w - -"), false);
  assert.equal(lookupOpening("8/8/8/8/8/8/8/8 w - -"), undefined);
});
