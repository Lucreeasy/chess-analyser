import { extractTags, movetextOf } from "./pgnText.ts";
import { tokenizeMovetext } from "./movetext.ts";
import { resolveStartPosition, replayGame } from "./replay.ts";
import { resolvePlayedAt } from "./dateTime.ts";
import {
  playerName,
  resolveMyColour,
  resolveResult,
  resolvePersonalResult,
  resolveRating,
  type Colour,
  type Result,
  type PersonalResult,
} from "./players.ts";
import { timeControlText, classifyTimeControl, type TimeClass } from "./timeClass.ts";
import { normalizeTermination } from "./termination.ts";
import { classifyOpening } from "./opening.ts";
import { gameId } from "./identity.ts";

/** What is stored for a game. docs/03-IMPORT-SPEC.md section 2.16. */
export interface StoredGame {
  id: string;
  source: "file" | "paste" | "chesscom_api";
  pgn: string;
  tags: Record<string, string>;
  white: string;
  black: string;
  whiteElo?: number;
  blackElo?: number;
  myColour?: Colour;
  result: Result;
  myResult?: PersonalResult;
  termination?: string;
  timeControlText: string;
  timeClass: TimeClass;
  playedAt: number;
  eco?: string;
  openingName?: string;
  openingFamily?: string;
  plyCount: number;
  importedAt: number;
  analysisStatus: "none";
}

export interface ParseGameResult {
  game?: StoredGame;
  failure?: string;
}

/**
 * Parses one already-split game's text into a stored game, or a failure
 * reason (section 2.18). `usernames` are already normalised (trimmed,
 * lower case).
 */
export function parseGame(
  gameText: string,
  source: StoredGame["source"],
  usernames: string[],
  importMoment: number,
): ParseGameResult {
  const tags = extractTags(gameText);
  const { moves, result: resultToken } = tokenizeMovetext(movetextOf(gameText));
  if (tags.size === 0 && moves.length === 0) {
    return { failure: "Empty game: no tag pairs and no moves" };
  }

  const start = resolveStartPosition(tags);
  if (start.failure) return { failure: start.failure };

  const terminationTag = tags.get("Termination");
  const needsFullReplay = !terminationTag || terminationTag.trim() === "";
  const replay = replayGame(start.fen, moves, needsFullReplay);
  if (replay.failure) return { failure: replay.failure };

  const white = playerName(tags.get("White"));
  const black = playerName(tags.get("Black"));
  const myColour = resolveMyColour(white, black, usernames);
  const result = resolveResult(tags.get("Result"), resultToken);
  const isStandardStart = tags.get("FEN") === undefined || tags.get("SetUp") === "0";
  const ecoTag = tags.get("ECO")?.trim() || undefined;
  const opening = classifyOpening(replay.fens, isStandardStart, ecoTag);

  const game: StoredGame = {
    id: gameId(tags, moves),
    source,
    pgn: gameText,
    tags: Object.fromEntries(tags),
    white,
    black,
    whiteElo: resolveRating(tags.get("WhiteElo")),
    blackElo: resolveRating(tags.get("BlackElo")),
    myColour,
    result,
    myResult: resolvePersonalResult(result, myColour),
    termination: normalizeTermination(terminationTag, replay.finalFen),
    timeControlText: timeControlText(tags.get("TimeControl")),
    timeClass: classifyTimeControl(tags.get("TimeControl")),
    playedAt: resolvePlayedAt(tags, importMoment),
    eco: opening.eco,
    openingName: opening.openingName,
    openingFamily: opening.openingFamily,
    plyCount: replay.plyCount,
    importedAt: importMoment,
    analysisStatus: "none",
  };
  return { game };
}
