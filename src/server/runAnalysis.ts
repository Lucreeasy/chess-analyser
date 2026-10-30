import { Chess } from "chess.js";
import type Database from "better-sqlite3";
import { epdOf } from "./analysis/book.ts";
import { terminalWhiteWinPercent } from "./analysis/terminal.ts";
import { analyseGame, type GameAnalysis, type PositionInput } from "./analysis/game.ts";
import type { UciEngine } from "./engine/engine.ts";
import { getCachedEval, putCachedEval } from "./db.ts";

const MULTIPV = 2;
const MOVETIME_MS = 5000;

export interface RunAnalysisOptions {
  depth: 12 | 16 | 20;
  engineName: string;
  myColour?: "w" | "b";
}

/**
 * Replays a PGN, gets every position evaluated (from the cache or the
 * engine) and runs the result through analyseGame. docs/02-ANALYSIS-SPEC.md
 * sections 2.3 (what is searched), 16 (cache).
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
  const plies = history.map((m) => ({ colour: m.color as "w" | "b", san: m.san, uci: m.lan }));

  const positions: PositionInput[] = [];
  for (let i = 0; i < fens.length; i++) {
    const fen = fens[i];
    const terminal = i === fens.length - 1 ? terminalWhiteWinPercent(fen) : undefined;
    if (terminal !== undefined) {
      positions.push({ fen, lines: [], terminalWhiteWinPercent: terminal });
      continue;
    }

    const epd = epdOf(fen);
    const cached = getCachedEval(db, epd, options.depth, MULTIPV);
    if (cached) {
      positions.push({ fen, lines: cached.lines });
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
