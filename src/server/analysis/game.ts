import { winPercentOfLine, type EngineLine } from "./winPercent.ts";
import { moverEp, epLoss } from "./expectedPoints.ts";
import { moveAccuracy } from "./moveAccuracy.ts";
import { gameAccuracy, harmonicMeanFloored } from "./gameAccuracy.ts";
import { epdOf, isInBook } from "./book.ts";
import { isSacrifice } from "./sacrifice.ts";
import { classifyMove, isError, ALL_CLASSES, type MoveClass } from "./classification.ts";
import { tacticTag, type EngineLineWithPv, type TacticTag } from "./tacticTags.ts";
import { phasesOf, ALL_PHASES, type Phase } from "./phases.ts";
import { parseTimeControl, deriveClocks, type PlyClockInput } from "./clock.ts";
import { selectKeyMoments } from "./keyMoments.ts";
import { annotatedSan, buildKeyMomentSentence } from "./texts.ts";
import { sanOf, pieceCapturedBy, sanLineOf } from "./notation.ts";

export type Colour = "w" | "b";


export interface PositionInput {
  /** Full FEN (with move counters) of this position. */
  fen: string;
  /** Engine lines, best first; empty when the position is terminal and was not searched. */
  lines: EngineLineWithPv[];
  /** Only used when `lines` is empty (section 2.5). */
  terminalWhiteWinPercent?: number;
}

export interface PlyInput {
  colour: Colour;
  san: string;
  uci: string;
  clockMs?: number;
}

export interface AnalyseGameInput {
  /** Length N+1: position 0 is the start, position i is after ply i. */
  positions: PositionInput[];
  /** Length N. */
  plies: PlyInput[];
  timeControlText: string;
  engineName: string;
  depth: 12 | 16 | 20;
  /** The side the analysed game belongs to, if known; freezes key-moment wording (section 13.2, 17.7). */
  myColour?: Colour;
}

export interface MoveRecord {
  ply: number;
  colour: Colour;
  san: string;
  uci: string;
  fenBefore: string;
  bestLine?: EngineLineWithPv;
  /** SAN of bestLine's first move, when it can be played from fenBefore (docs/06-GAMES-SPEC.md section B3). */
  bestSan?: string;
  /** bestLine's first 6 plies as move text, from fenBefore (docs/06-GAMES-SPEC.md section B7's Explanation). */
  engineLineText?: string;
  secondLine?: EngineLineWithPv;
  /** White POV. */
  winPercentBefore: number;
  /** White POV. */
  winPercentAfter: number;
  /** Mover POV, raw (section 4.3: no tolerance). */
  epLoss: number;
  accuracy: number;
  classification: MoveClass;
  tag?: TacticTag;
  phase: Phase;
  clockMs?: number;
  timeSpentMs?: number;
  inTimeTrouble?: boolean;
}

export interface KeyMoment {
  ply: number;
  swing: number;
  sentence: string;
}

export interface GameSummary {
  engine: string;
  depth: number;
  analysedAt: number;
  accuracy: Record<Colour, number>;
  counts: Record<Colour, Record<MoveClass, number>>;
  phaseAccuracy: Record<Colour, Partial<Record<Phase, number>>>;
  maxEp: Record<Colour, number>;
  minEp: Record<Colour, number>;
  keyMoments: KeyMoment[];
}

export interface GameAnalysis {
  moves: MoveRecord[];
  summary: GameSummary;
}

function whitePovWinPercent(position: PositionInput): number {
  if (position.lines.length > 0) return winPercentOfLine(position.lines[0] as EngineLine);
  return position.terminalWhiteWinPercent ?? 50;
}

/** docs/02-ANALYSIS-SPEC.md section 5: mover-POV Win% for moveAccuracy's inputs. */
function moverWinPercent(whiteWinPercent: number, mover: Colour): number {
  return mover === "w" ? whiteWinPercent : 100 - whiteWinPercent;
}

/** Per-move record and per-game summary. docs/02-ANALYSIS-SPEC.md section 12. */
export function analyseGame(input: AnalyseGameInput): GameAnalysis {
  const { positions, plies, timeControlText, engineName, depth, myColour } = input;
  const plyCount = plies.length;

  const whiteWinPercents = positions.map(whitePovWinPercent);
  const bookFlags = positions.map((p) => isInBook(epdOf(p.fen)));
  const phases = phasesOf(positions.slice(1).map((p) => p.fen), bookFlags.slice(1));

  const control = parseTimeControl(timeControlText);
  const clockInputs: PlyClockInput[] = plies.map((p) => ({ colour: p.colour, clockMs: p.clockMs }));
  const clocks = deriveClocks(control, clockInputs);

  const moves: MoveRecord[] = [];
  const bookStreak: Record<Colour, boolean> = { w: true, b: true };
  let previousColour: Colour | undefined;
  let previousClass: MoveClass | undefined;
  let previousUci: string | undefined;
  let previousSan: string | undefined;

  for (let i = 1; i <= plyCount; i++) {
    const ply = plies[i - 1];
    const before = positions[i - 1];
    const after = positions[i];
    const best = before.lines[0];
    const second = before.lines[1];

    const epBefore = moverEp(whiteWinPercents[i - 1], ply.colour);
    const epAfter = moverEp(whiteWinPercents[i], ply.colour);
    const loss = epLoss(epBefore, epAfter);
    const accuracy = moveAccuracy(
      moverWinPercent(whiteWinPercents[i - 1], ply.colour),
      moverWinPercent(whiteWinPercents[i], ply.colour),
    );

    const positionAfterInBook = bookFlags[i];
    const isBookMove = positionAfterInBook && bookStreak[ply.colour];
    if (!isBookMove) bookStreak[ply.colour] = false;

    const isRecapture =
      previousUci !== undefined &&
      previousSan!.includes("x") &&
      ply.san.includes("x") &&
      previousUci.slice(2, 4) === ply.uci.slice(2, 4);
    const isPromotion = ply.uci.length > 4;

    const sacrifice = isSacrifice(before.fen, ply.uci, ply.colour, after.lines[0]?.pv ?? []);
    const epOfLine2 = second ? moverEp(winPercentOfLine(second as EngineLine), ply.colour) : undefined;

    const classification = classifyMove({
      playedUci: ply.uci,
      engineUci: best?.pv[0],
      epBefore,
      epAfter,
      epLoss: loss,
      epOfLine2,
      isBook: isBookMove,
      previousOpponentClass: previousColour !== undefined && previousColour !== ply.colour ? previousClass : undefined,
      isRecapture,
      isPromotion,
      isSacrifice: sacrifice,
    });

    const tag = isError(classification)
      ? tacticTag({ mover: ply.colour, fenBefore: before.fen, playedUci: ply.uci, fenAfter: after.fen, best, after: after.lines[0] })
      : undefined;

    moves.push({
      ply: i,
      colour: ply.colour,
      san: ply.san,
      uci: ply.uci,
      fenBefore: before.fen,
      bestLine: best,
      bestSan: best?.pv[0] ? sanOf(before.fen, best.pv[0]) : undefined,
      engineLineText: best ? sanLineOf(before.fen, best.pv, 6) : undefined,
      secondLine: second,
      winPercentBefore: whiteWinPercents[i - 1],
      winPercentAfter: whiteWinPercents[i],
      epLoss: loss,
      accuracy,
      classification,
      tag,
      phase: phases[i - 1],
      clockMs: clocks[i - 1].clockMs,
      timeSpentMs: clocks[i - 1].timeSpentMs,
      inTimeTrouble: clocks[i - 1].inTimeTrouble,
    });

    previousColour = ply.colour;
    previousClass = classification;
    previousUci = ply.uci;
    previousSan = ply.san;
  }

  const firstMover = plies[0]?.colour ?? "w";
  const { white, black } = gameAccuracy(whiteWinPercents, firstMover);
  const accuracyByColour: Record<Colour, number> = { w: white, b: black };

  const counts: Record<Colour, Record<MoveClass, number>> = {
    w: Object.fromEntries(ALL_CLASSES.map((c) => [c, 0])) as Record<MoveClass, number>,
    b: Object.fromEntries(ALL_CLASSES.map((c) => [c, 0])) as Record<MoveClass, number>,
  };
  for (const move of moves) counts[move.colour][move.classification]++;

  const phaseAccuracy: Record<Colour, Partial<Record<Phase, number>>> = { w: {}, b: {} };
  for (const colour of ["w", "b"] as const) {
    for (const phase of ALL_PHASES) {
      const inPhase = moves.filter((m) => m.colour === colour && m.phase === phase).map((m) => m.accuracy);
      const value = harmonicMeanFloored(inPhase);
      if (value !== undefined) phaseAccuracy[colour][phase] = value;
    }
  }

  const maxEp: Record<Colour, number> = {
    w: Math.max(...whiteWinPercents) / 100,
    b: Math.max(...whiteWinPercents.map((w) => 100 - w)) / 100,
  };
  const minEp: Record<Colour, number> = {
    w: Math.min(...whiteWinPercents) / 100,
    b: Math.min(...whiteWinPercents.map((w) => 100 - w)) / 100,
  };

  const keyMomentEntries = selectKeyMoments(moves.map((m) => ({ ply: m.ply, swing: m.epLoss * 100 })));
  const keyMoments: KeyMoment[] = keyMomentEntries.map((entry) => {
    const move = moves[entry.ply - 1];
    const fenAfter = positions[entry.ply].fen;
    const replyUci = positions[entry.ply].lines[0]?.pv[0];
    const bestUci = move.bestLine?.pv[0];
    const bestSanRaw = bestUci ? sanOf(move.fenBefore, bestUci) : undefined;
    const bestSan = bestSanRaw !== undefined && bestSanRaw !== move.san ? bestSanRaw : undefined;
    const replySan = replyUci ? sanOf(fenAfter, replyUci) : undefined;
    const replyPieceCaptured = replyUci ? pieceCapturedBy(fenAfter, replyUci) : undefined;

    return {
      ply: entry.ply,
      swing: entry.swing,
      sentence: buildKeyMomentSentence({
        tag: move.tag,
        mover: move.colour,
        myColour,
        move: annotatedSan(move.san, move.classification),
        replySan,
        replyPieceCaptured,
        bestSan,
        swing: entry.swing,
      }),
    };
  });

  return {
    moves,
    summary: {
      engine: engineName,
      depth,
      analysedAt: Date.now(),
      accuracy: accuracyByColour,
      counts,
      phaseAccuracy,
      maxEp,
      minEp,
      keyMoments,
    },
  };
}
