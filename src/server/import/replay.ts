import { Chess } from "chess.js";
import { BOOK_DEPTH } from "../analysis/book.ts";
import type { MovetextToken } from "./movetext.ts";

const NULL_MOVES = new Set(["--", "Z0", "z0"]);
const PLAUSIBLE_SHAPE =
  /^(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h][1-8][a-h][1-8][qrbn]?|O-O(?:-O)?|0-0(?:-0)?)$/i;

export interface StartPosition {
  fen: string;
  failure?: string;
}

/** The start position from the FEN/SetUp/Variant tags, or a failure reason. Section 2.6. */
export function resolveStartPosition(tags: Map<string, string>): StartPosition {
  const variant = (tags.get("Variant") ?? "").trim().toLowerCase();
  if (variant !== "" && variant !== "standard" && variant !== "chess") {
    return { fen: "", failure: `Unsupported variant "${tags.get("Variant")}": only standard chess is supported` };
  }

  const fenTag = tags.get("FEN");
  const setUp = tags.get("SetUp");
  if (fenTag === undefined || setUp === "0") {
    return { fen: new Chess().fen() };
  }
  try {
    return { fen: new Chess(fenTag).fen() };
  } catch (error) {
    const reason = error instanceof Error ? error.message.replace(/^Invalid FEN:\s*/, "") : String(error);
    return { fen: "", failure: `Invalid starting position in FEN header "${fenTag}": ${reason}` };
  }
}

function moveFailure(kind: string, move: string, moveNumber: number, colour: "w" | "b"): string {
  return colour === "w"
    ? `${kind} move "${move}" at move ${moveNumber}. (White)`
    : `${kind} move "${move}" at move ${moveNumber}... (Black)`;
}

export interface ReplayResult {
  plyCount: number;
  /** The final position, only when the game was replayed all the way to the end. */
  finalFen?: string;
  /** The FEN after each fully-replayed ply, for opening lookup (section 2.14). */
  fens: string[];
  /** Each fully-replayed ply's move, from/to squares as "e2e4" (docs/06-GAMES-SPEC.md section B3), parallel to `fens`. */
  uci: string[];
  /** Each fully-replayed ply's move in SAN ("Nxe5"), parallel to `fens` (docs/06-GAMES-SPEC.md section B7 Moves tab). */
  sans: string[];
  failure?: string;
}

/**
 * Replays a game's moves: fully (legality checked) up to `BOOK_DEPTH`
 * plies, or further when `fullReplay` is requested; later moves are only
 * checked for a plausible shape. Section 2.15, 2.18.
 */
export function replayGame(startFen: string, moves: MovetextToken[], fullReplay: boolean): ReplayResult {
  const chess = new Chess(startFen);
  const fens: string[] = [];
  const uci: string[] = [];
  const sans: string[] = [];

  for (let i = 0; i < moves.length; i++) {
    const token = moves[i].raw;
    const colour = chess.turn();
    const moveNumber = Number(chess.fen().split(" ")[5]);

    if (!fullReplay && i >= BOOK_DEPTH) {
      if (!PLAUSIBLE_SHAPE.test(token)) {
        return { plyCount: moves.length, fens, uci, sans, failure: moveFailure("Illegal or unreadable", token, moveNumber, colour) };
      }
      continue;
    }

    if (NULL_MOVES.has(token)) {
      return { plyCount: moves.length, fens, uci, sans, failure: moveFailure("Unsupported null", token, moveNumber, colour) };
    }
    let move;
    try {
      move = chess.move(token);
    } catch {
      return { plyCount: moves.length, fens, uci, sans, failure: moveFailure("Illegal or unreadable", token, moveNumber, colour) };
    }
    fens.push(chess.fen());
    uci.push(move.lan);
    sans.push(move.san);
  }

  const replayedToTheEnd = fullReplay || moves.length <= BOOK_DEPTH;
  return { plyCount: moves.length, fens, uci, sans, finalFen: replayedToTheEnd ? chess.fen() : undefined };
}
