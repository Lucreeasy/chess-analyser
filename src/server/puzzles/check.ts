/**
 * Checking one answer to a puzzle: the solution list first, then "within tolerance" by an evaluation of the
 * position after the attempted move; without an engine only the solution list counts ("strict").
 */
import type Database from "better-sqlite3";
import type { UciEngine } from "../engine/engine.ts";
import { epdOf } from "../analysis/book.ts";
import { getCachedEval, putCachedEval } from "../db.ts";
import { moverEp } from "../analysis/expectedPoints.ts";
import { winPercentOfLine, type EngineLine } from "../analysis/winPercent.ts";
import { terminalWhiteWinPercent } from "../analysis/terminal.ts";
import { sanLineOf, sanOf } from "../analysis/notation.ts";
import { CLASS_INFO, TAG_INFO } from "../analysis/texts.ts";
import { applyMove } from "../explore/position.ts";
import { TOLERANCE } from "./select.ts";
import { afterAttempt, type Schedule } from "./schedule.ts";
import type { Puzzle } from "./store.ts";

/** White-POV first line of the position, or undefined when no evaluation can be had. */
export type Evaluate = (fen: string) => Promise<EngineLine | undefined>;

const CACHE_DEPTHS = [20, 16, 12];
const MULTIPV = 2;
const QUICK = { depth: 12, multipv: MULTIPV, movetimeMs: 2500 };
const HARD_TIMEOUT_MS = 8000;
const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** The cache, deepest first, else a quick search stored for later; undefined when the engine cannot answer. */
export function puzzleEvaluator(db: Database.Database, getEngine: () => Promise<UciEngine>): Evaluate {
  return async (fen) => {
    const epd = epdOf(fen);
    for (const depth of CACHE_DEPTHS) {
      const cached = getCachedEval(db, epd, depth, MULTIPV)?.lines[0];
      if (cached) return cached;
    }
    try {
      const engine = await getEngine();
      let stop = () => {};
      const timeout = new Promise<undefined>((resolve) => {
        const timer = setTimeout(resolve, HARD_TIMEOUT_MS);
        stop = () => clearTimeout(timer);
      });
      const result = await Promise.race([engine.analyse(fen, fen.split(" ")[1] as "w" | "b", QUICK), timeout]).finally(stop);
      if (!result?.lines[0]) throw new Error(result ? "no engine lines" : `no answer within ${HARD_TIMEOUT_MS / 1000} s`);
      putCachedEval(db, epd, QUICK.depth, MULTIPV, result.lines, result.reachedDepth);
      return result.lines[0];
    } catch (error) {
      console.error("puzzle check falls back to the solution list:", error);
      return undefined;
    }
  };
}

/** 0..1 as a whole percent; anything positive is at least 1. */
const percent = (x: number) => (x <= 0 ? 0 : Math.max(1, Math.round(x * 100)));

export async function checkAnswer(p: Puzzle, input: { move?: unknown; giveUp?: unknown }, evaluate: Evaluate, now: number) {
  if (input.giveUp !== undefined && typeof input.giveUp !== "boolean") return { error: "giveUp must be true or false" };
  const giveUp = input.giveUp === true;
  const move = typeof input.move === "string" ? input.move.trim().toLowerCase() : undefined;
  if (!giveUp && (move === undefined || !UCI_MOVE.test(move))) return { error: "move must look like e2e4 or e7e8q" };
  const played = giveUp ? undefined : applyMove(p.fen, move!);
  if (played && !played.ok) return { error: `${move} is not a legal move in this position` };

  const mover = p.fen.split(" ")[1] as "w" | "b";
  const best = p.solution[0];
  const bestSan = sanOf(p.fen, best) ?? best;
  let acceptedBy: "solution" | "tolerance" | undefined;
  let epLoss: number | undefined;
  let strict = false;
  if (played && p.solution.includes(move!)) acceptedBy = "solution";
  else if (played) {
    const terminal = terminalWhiteWinPercent(played.fen!);
    const line = terminal === undefined ? await evaluate(played.fen!) : undefined;
    const white = terminal ?? (line && winPercentOfLine(line));
    if (white === undefined) strict = true;
    else {
      epLoss = Math.max(0, p.bestEp - moverEp(white, mover));
      if (epLoss <= TOLERANCE + 1e-9) acceptedBy = "tolerance";
    }
  }

  const attempt = played?.san;
  const verdict = giveUp
    ? `The engine's choice was ${bestSan}.`
    : acceptedBy === "solution"
      ? move === best
        ? `Correct: ${bestSan} is the engine's choice.`
        : `Correct: ${attempt} is as good as the engine's ${bestSan}.`
      : acceptedBy === "tolerance"
        ? `Not the engine's first choice (${bestSan}), but within ${percent(TOLERANCE)}% of it: ${attempt} gives up only ${percent(epLoss!)}% of your winning chances.`
        : strict
          ? `${attempt} is not one of the accepted moves. The engine prefers ${bestSan}.`
          : `${attempt} gives up ${percent(epLoss!)}% of your winning chances compared to ${bestSan}.`;
  const explanation = [verdict, `In the game you played ${p.playedSan}${CLASS_INFO[p.playedClass].glyph}.`, p.tag && TAG_INFO[p.tag].sentence]
    .filter(Boolean)
    .join(" ");

  const correct = acceptedBy !== undefined;
  const schedule: Schedule = afterAttempt(p, correct, now);
  return {
    schedule,
    result: {
      correct,
      acceptedBy: acceptedBy ?? "none",
      best,
      bestSan,
      solution: p.solution,
      solutionSan: p.solution.map((m) => sanOf(p.fen, m) ?? m),
      epLoss,
      attempt: played?.uci,
      attemptSan: attempt,
      dueAt: schedule.dueAt,
      intervalDays: schedule.intervalDays,
      retired: schedule.dueAt === undefined,
      explanation,
      bestLineText: sanLineOf(p.fen, p.bestLine, 6),
      strict,
    },
  };
}
