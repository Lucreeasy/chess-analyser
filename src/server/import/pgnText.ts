/**
 * Splitting a PGN text into games, and reading one game's tag block.
 */

const TAG_LINE = /^\s*\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"\\])*)"\s*\]\s*$/;

export interface Tag {
  name: string;
  value: string;
}

function unescape(value: string): string {
  return value.replace(/\\(["\\])/g, "$1");
}

/** Parses one line as a tag pair ([Name "value"]), or null if it is not one. */
export function parseTagLine(line: string): Tag | null {
  const match = TAG_LINE.exec(line);
  return match ? { name: match[1], value: unescape(match[2]) } : null;
}

/** Normalises line endings (CRLF, CR, LF) to LF and strips a single leading BOM. */
export function normalizeText(text: string): string {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return withoutBom.replace(/\r\n|\r/g, "\n");
}

/** Tracks a brace comment across lines: not nested, closes at the next "}". */
function updateBraceState(line: string, isOpen: boolean): boolean {
  for (const ch of line) {
    if (!isOpen && ch === "{") isOpen = true;
    else if (isOpen && ch === "}") isOpen = false;
  }
  return isOpen;
}

/** Splits a text into the trimmed text of each game it contains. */
export function splitIntoGames(rawText: string): string[] {
  const lines = normalizeText(rawText).split("\n");

  const games: string[][] = [];
  let current: string[] = [];
  let started = false;
  let hasMovetext = false;
  let seenEventTag = false;
  let isOpenComment = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const wasOpenAtStart = isOpenComment;
    isOpenComment = updateBraceState(line, isOpenComment);

    if (trimmed === "") {
      if (started) current.push(line); // blank lines inside a game are kept; before one, ignored
      continue;
    }

    const tag = wasOpenAtStart ? null : parseTagLine(line);
    if (tag) {
      if (hasMovetext || (tag.name === "Event" && seenEventTag)) {
        games.push(current);
        current = [];
        hasMovetext = false;
        seenEventTag = false;
      }
      current.push(trimmed);
      if (tag.name === "Event") seenEventTag = true;
    } else {
      hasMovetext = true;
      current.push(line.replace(/[ \t]+$/, ""));
    }
    started = true;
  }
  if (started) games.push(current);

  return games.map((g) => g.join("\n").trim()).filter((g) => g.length > 0);
}

/** Reads one game's leading tag block (first occurrence of a repeated tag wins). */
export function extractTags(gameText: string): Map<string, string> {
  const tags = new Map<string, string>();
  for (const [tag] of walkTagBlock(gameText)) {
    if (!tags.has(tag.name)) tags.set(tag.name, tag.value);
  }
  return tags;
}

/** The game's text after its leading tag block: the raw movetext to tokenize. */
export function movetextOf(gameText: string): string {
  const lines = gameText.split("\n");
  let lastTagLine = -1;
  for (const [, index] of walkTagBlock(gameText)) lastTagLine = index;
  return lines.slice(lastTagLine + 1).join("\n");
}

/** Yields [tag, lineIndex] for each leading tag line, stopping at the first non-blank non-tag line. */
function* walkTagBlock(gameText: string): Generator<[Tag, number]> {
  let isOpenComment = false;
  const lines = gameText.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim() === "") continue;
    const wasOpenAtStart = isOpenComment;
    isOpenComment = updateBraceState(line, isOpenComment);

    const tag = wasOpenAtStart ? null : parseTagLine(line);
    if (!tag) return;
    yield [tag, index];
  }
}
