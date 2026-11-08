/**
 * The raw style features behind the playstyle radar. docs/04-INSIGHTS-SPEC.md section 11.
 */
import { Chess } from "chess.js";
import type { Colour, MoveRecord } from "../analysis/game.ts";
import { fileOf, opponentOf, rankOf } from "../analysis/material.ts";
import { populationSd } from "../analysis/gameAccuracy.ts";
import { mean, myMoves, share, type Stat } from "./overview.ts";
import type { UsedGame } from "./select.ts";

const VOLATILITY_WINDOW = 10;
const VOLATILITY_MIN_POSITIONS = 5;

export interface StyleFeatures {
  checksCaptures: Stat;
  opponentHalf: Stat;
  pawnStorm: Stat;
  oppositeCastling: Stat;
  volatility: Stat;
  bestMoveRate: Stat;
}

const destination = (m: MoveRecord) => m.uci.slice(2, 4);

function inOpponentHalf(m: MoveRecord): boolean {
  const rank = rankOf(destination(m)); // 0-based
  return m.colour === "w" ? rank >= 4 : rank <= 3;
}

function isPawnStorm(m: MoveRecord): boolean {
  if (!/^[a-h]/.test(m.san) || !inOpponentHalf(m)) return false;
  const [enemyKing] = new Chess(m.fenBefore, { skipValidation: true }).findPiece({ type: "k", color: opponentOf(m.colour) });
  return enemyKing !== undefined && Math.abs(fileOf(destination(m)) - fileOf(enemyKing)) <= 2;
}

/** "kingside" / "queenside" of a side's first castling, if it castled. */
function castlingSide(moves: MoveRecord[], colour: Colour): string | undefined {
  const castle = moves.find((m) => m.colour === colour && m.san.startsWith("O-O"));
  return castle && (castle.san.startsWith("O-O-O") ? "queenside" : "kingside");
}

/** Mean over my moves of the Win% SD of the (up to) 10 positions starting after the move; undefined if no window qualifies. */
function gameVolatility(u: UsedGame): number | undefined {
  const moves = u.analysis.moves;
  const positions = [moves[0].winPercentBefore, ...moves.map((m) => m.winPercentAfter)];
  const windows = moves
    .filter((m) => m.colour === u.me)
    .map((m) => positions.slice(m.ply, m.ply + VOLATILITY_WINDOW))
    .filter((w) => w.length >= VOLATILITY_MIN_POSITIONS)
    .map(populationSd);
  return mean(windows).value;
}

export function styleFeatures(used: UsedGame[]): StyleFeatures {
  const moves = used.flatMap(myMoves);
  const checksCaptures = moves.reduce((sum, m) => sum + (/[+#]$/.test(m.san) ? 1 : 0) + (m.san.includes("x") ? 1 : 0), 0);
  const bothCastled = used
    .map((u) => [castlingSide(u.analysis.moves, "w"), castlingSide(u.analysis.moves, "b")])
    .filter(([w, b]) => w && b);
  const notBook = moves.filter((m) => m.classification !== "book");
  const volatilities = used.map(gameVolatility).filter((v) => v !== undefined);
  return {
    checksCaptures: share(checksCaptures, moves.length),
    opponentHalf: share(moves.filter(inOpponentHalf).length, moves.length),
    pawnStorm: share(moves.filter(isPawnStorm).length, moves.length),
    oppositeCastling: share(bothCastled.filter(([w, b]) => w !== b).length, bothCastled.length),
    volatility: mean(volatilities),
    bestMoveRate: share(notBook.filter((m) => ["best", "great", "brilliant"].includes(m.classification)).length, notBook.length),
  };
}
