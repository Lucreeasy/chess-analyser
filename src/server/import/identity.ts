import { createHash } from "node:crypto";
import type { MovetextToken } from "./movetext.ts";

/** Game identity. docs/03-IMPORT-SPEC.md section 2.13. */

function normalizeMoveForHash(raw: string): string {
  const withoutCheckMarks = raw.replace(/[+#]+$/, "");
  if (withoutCheckMarks === "0-0") return "O-O";
  if (withoutCheckMarks === "0-0-0") return "O-O-O";
  return withoutCheckMarks;
}

/** The trimmed Link tag if present, else the SHA-1 of the sorted tags and the moves as written. */
export function gameId(tags: Map<string, string>, moves: MovetextToken[]): string {
  const link = tags.get("Link")?.trim();
  if (link) return link;

  const sortedTags = [...tags.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const tagPart = sortedTags.map(([name, value]) => `${name}=${value.trim()}`).join("\n");
  const movePart = moves.map((m) => normalizeMoveForHash(m.raw)).join(" ");
  return createHash("sha1").update(`${tagPart}\n\n${movePart}`, "utf8").digest("hex");
}
