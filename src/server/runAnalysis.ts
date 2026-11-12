import { Chess } from "chess.js";
import type Database from "better-sqlite3";
import { epdOf } from "./analysis/book.ts";
import { terminalWhiteWinPercent } from "./analysis/terminal.ts";
import { analyseGame, type GameAnalysis, type PositionInput } from "./analysis/game.ts";
import { winPercentOfLine } from "./analysis/winPercent.ts";
import { parseClockMs } from "./analysis/clock.ts";
import { movetextOf } from "./import/pgnText.ts";
import { tokenizeMovetext } from "./import/movetext.ts";
import type { UciEngine } from "./engine/engine.ts";
import { getCachedEval, putCachedEval } from "./db.ts";

const MULTIPV = 2;
const MOVETIME_MS = 5000;

/**
 * Thrown when `options.signal` is aborted mid-analysis (pause aborts the
 * running game; no partial result is saved).
 */
export class AnalysisAbortedError extends Error {}

export interface RunAnalysisOptions {
  depth: 12 | 16 | 20;
  engineName: string;
  myColour?: "w" | "b";
  /** Called after each position is evaluated (the live progress/plyEval events). */
  onPosition?: (ply: number, totalPlies: number, whiteWinPercent: number) => void;
  /** Checked between positions; aborting mid-search is bounded by MOVETIME_MS (5s). */
  signal?: AbortSignal;
}

/**
 * Replays a PGN, gets every position evaluated (from the cache or the
 * engine) and runs the result through analyseGame.
 */
export async function runAnalysis(
  db: Database.Database,
  engine: UciEngine,
  pgn: string,
  options: RunAnalysisOptions,
): Promise<GameAnalysis> {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const history = chess.history({ verbose: true });

  const fens = [history[0]?.before ?? chess.fen(), ...history.map((m) => m.after)];
  // Each main-line move's comment, in history order, for its "[%clk ...]".
  const comments = tokenizeMovetext(movetextOf(pgn)).moves.map((t) => t.comment);
  const plies = history.map((m, i) => ({
    colour: m.color as "w" | "b",
    san: m.san,
    uci: m.lan,
    clockMs: comments[i] === undefined ? undefined : parseClockMs(comments[i]),
  }));

  const totalPlies = fens.length - 1;
  const positions: PositionInput[] = [];
  for (let i = 0; i < fens.length; i++) {
    if (options.signal?.aborted) throw new AnalysisAbortedError("analysis aborted");
    const fen = fens[i];
    const terminal = i === fens.length - 1 ? terminalWhiteWinPercent(fen) : undefined;
    if (terminal !== undefined) {
      positions.push({ fen, lines: [], terminalWhiteWinPercent: terminal });
      options.onPosition?.(i, totalPlies, terminal);
      continue;
    }

    const epd = epdOf(fen);
    const cached = getCachedEval(db, epd, options.depth, MULTIPV);
    if (cached) {
      positions.push({ fen, lines: cached.lines });
      options.onPosition?.(i, totalPlies, winPercentOfLine(cached.lines[0]!));
      continue;
    }

    const sideToMove = fen.split(" ")[1] === "b" ? "b" : "w";
    const { lines, reachedDepth } = await engine.analyse(fen, sideToMove, {
      depth: options.depth,
      multipv: MULTIPV,
      movetimeMs: MOVETIME_MS,
    });
    if (lines.length === 0) throw new Error(`the engine returned no lines for position ${i}`);
    putCachedEval(db, epd, options.depth, MULTIPV, lines, reachedDepth);
    positions.push({ fen, lines });
    options.onPosition?.(i, totalPlies, winPercentOfLine(lines[0]!));
  }

  const timeControlText = chess.header().TimeControl ?? "-";
  return analyseGame({
    positions,
    plies,
    timeControlText,
    engineName: options.engineName,
    depth: options.depth,
    myColour: options.myColour,
  });
}
