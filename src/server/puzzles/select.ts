/**
 * Which of my moves in an analysed game become puzzles, and what each puzzle stores.
 */
import { createHash } from "node:crypto";
import type { Colour, MoveRecord } from "../analysis/game.ts";
import type { MoveClass } from "../analysis/classification.ts";
import type { TacticTag } from "../analysis/tacticTags.ts";
import type { Phase } from "../analysis/phases.ts";
import { moverEp } from "../analysis/expectedPoints.ts";
import { isForcedMateFor, winPercentOfLine, type EngineLine } from "../analysis/winPercent.ts";

const PUZZLE_CLASSES: MoveClass[] = ["mistake", "blunder", "miss"];
const MIN_BEST_EP = 0.15;
const MAX_PER_GAME = 6;
/** Alternatives within this much EP of the best line are accepted too; also the answer check's tolerance. */
export const TOLERANCE = 0.02;
const EPSILON = 1e-9;
const BEST_LINE_PLIES = 6;

/** What a puzzle stores besides its schedule. */
export interface PuzzleContent {
  id: string;
  gameId: string;
  /** 1-based ply of my move; the puzzle position is the one before it. */
  ply: number;
  fen: string;
  /** 1-2 accepted first moves in coordinate form ("e2e4", "e7e8q"); the first is the engine's best. */
  solution: string[];
  tag?: TacticTag;
  phase: Phase;
  bestEp: number;
  /** The engine's best line, its first 6 plies in coordinate form. */
  bestLine: string[];
  playedSan: string;
  playedUci: string;
  playedClass: MoveClass;
  epLoss: number;
}

/** A stable, URL-safe id from (game id, ply) alone. */
export function puzzleId(gameId: string, ply: number): string {
  return createHash("sha1").update(`${gameId}#${ply}`).digest("hex").slice(0, 16);
}

const lineEp = (line: EngineLine, mover: Colour) => moverEp(winPercentOfLine(line), mover);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The puzzle a move gives, or undefined when a rule rejects it (rules checked in order). */
function puzzleOf(gameId: string, move: MoveRecord, me: Colour): PuzzleContent | undefined {
  if (move.colour !== me) return undefined;
  if (!PUZZLE_CLASSES.includes(move.classification)) return undefined;
  const best = move.bestLine?.pv[0];
  if (!best || !move.bestLine) return undefined;
  if (same(best, move.uci)) return undefined;
  if (move.fenBefore.split(" ")[1] !== me) return undefined;
  const bestEp = lineEp(move.bestLine, me);
  if (bestEp < MIN_BEST_EP || isForcedMateFor(move.bestLine, me === "w" ? "b" : "w")) return undefined;

  const solution = [best.trim().toLowerCase()];
  const second = move.secondLine?.pv[0];
  if (second && move.secondLine && !same(second, best) && bestEp - lineEp(move.secondLine, me) <= TOLERANCE + EPSILON) {
    solution.push(second.trim().toLowerCase());
  }
  return {
    id: puzzleId(gameId, move.ply),
    gameId,
    ply: move.ply,
    fen: move.fenBefore,
    solution,
    tag: move.tag,
    phase: move.phase,
    bestEp,
    bestLine: move.bestLine.pv.slice(0, BEST_LINE_PLIES),
    playedSan: move.san,
    playedUci: move.uci,
    playedClass: move.classification,
    epLoss: move.epLoss,
  };
}

/** A game's puzzles: the 6 largest EP losses (ties: earlier ply), stored in game order. */
export function puzzlesOfGame(gameId: string, moves: MoveRecord[], me: Colour | undefined): PuzzleContent[] {
  if (!me) return [];
  return moves
    .flatMap((m) => puzzleOf(gameId, m, me) ?? [])
    .sort((a, b) => b.epLoss - a.epLoss || a.ply - b.ply)
    .slice(0, MAX_PER_GAME)
    .sort((a, b) => a.ply - b.ply);
}
