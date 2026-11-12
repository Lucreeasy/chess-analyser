/** The sample PGN files the import tests read (tests/fixtures/pgn). */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SAMPLES_DIR = fileURLToPath(new URL("./pgn/", import.meta.url));

export function sample(name: string): string {
  return readFileSync(SAMPLES_DIR + name, "utf8");
}
