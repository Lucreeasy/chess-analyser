import { createHash } from "node:crypto";
import { Chess } from "chess.js";
import type { Game } from "./db.ts";

/**
 * Parses one game of PGN text and turns it into a stored Game record.
 * This is the thinnest slice of the import pipeline (docs/03-IMPORT-SPEC.md
 * defines the full rules: splitting a text into several games, duplicate
 * ids, failure reasons, opening lookup); it is extended to match that spec
 * in a later phase.
 */
export function parseGame(pgn: string, importedAt: number): Game {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const header = chess.header();
  const white = header.White?.trim() || "?";
  const black = header.Black?.trim() || "?";
  const result = header.Result?.trim() || "*";
  const id = header.Link?.trim() || createHash("sha1").update(pgn).digest("hex");
  return { id, white, black, result, pgn, importedAt };
}
