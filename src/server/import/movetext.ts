/**
 * Reading movetext: never fails, extracts the main-line move tokens (in
 * their original, possibly lenient, spelling) and ignores everything else.
 */

export interface MovetextToken {
  /** The move as written (lenient spelling kept as is; chess.js corrects it on replay). */
  raw: string;
  /** The brace comment(s) immediately following this move in the main line, if any. */
  comment?: string;
}

export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*";

export interface MovetextResult {
  moves: MovetextToken[];
  /** The result token found in the movetext, if any. */
  result?: GameResult;
}

const STANDALONE_SYMBOLS = new Set([
  "!", "?", "!!", "??", "!?", "?!",
  "+-", "-+", "+/-", "-/+", "+=", "=+", "=", "∞", "=/∞", "±", "∓", "⩲", "⩱",
  "e.p.",
]);
const TRAILING_SUFFIX = /(?:!!|\?\?|!\?|\?!|[!?])$/;

export function tokenizeMovetext(text: string): MovetextResult {
  const moves: MovetextToken[] = [];
  let result: GameResult | undefined;
  let variationDepth = 0;
  let atLineStart = true;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    if (atLineStart && ch === "%") {
      while (i < n && text[i] !== "\n") i++;
      continue;
    }
    atLineStart = false;

    if (ch === "\n") {
      atLineStart = true;
      i++;
      continue;
    }
    if (ch === ";") {
      while (i < n && text[i] !== "\n") i++;
      continue;
    }
    if (ch === "{") {
      const start = i + 1;
      const close = text.indexOf("}", start);
      const end = close === -1 ? n : close;
      const comment = text.slice(start, end);
      i = close === -1 ? n : close + 1;
      if (variationDepth === 0 && moves.length > 0) {
        const last = moves[moves.length - 1];
        last.comment = (last.comment ?? "") + comment;
      }
      continue;
    }
    if (ch === "(") {
      variationDepth++;
      i++;
      continue;
    }
    if (ch === ")") {
      if (variationDepth > 0) variationDepth--;
      i++;
      continue;
    }
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    let j = i;
    while (j < n && !/[\s{}();\n]/.test(text[j])) j++;
    let token = text.slice(i, j);
    i = j;

    if (variationDepth > 0) continue;

    token = token.replace(/^\d+\.(\.\.)?/, "");
    if (token === "") continue;

    if (token === "1-0" || token === "0-1" || token === "*") {
      result = token;
      break;
    }
    if (token === "1/2-1/2" || token === "½-½") {
      result = "1/2-1/2";
      break;
    }
    if (/^\$\d+$/.test(token) || STANDALONE_SYMBOLS.has(token)) continue;

    const withoutSuffix = token.replace(TRAILING_SUFFIX, "");
    if (withoutSuffix === "") continue; // the whole token was a quality mark

    moves.push({ raw: withoutSuffix });
  }

  return { moves, result };
}
