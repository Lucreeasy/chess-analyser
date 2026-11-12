import type { MoveClass } from "./classification.ts";
import type { TacticTag } from "./tacticTags.ts";

export const CLASS_INFO: Record<MoveClass, { label: string; glyph: string; description: string }> = {
  book: { label: "Book", glyph: "", description: "A known opening move." },
  brilliant: { label: "Brilliant", glyph: "!!", description: "A sound sacrifice." },
  great: { label: "Great", glyph: "!", description: "The only move that keeps the position under control." },
  best: { label: "Best", glyph: "", description: "The engine's first choice." },
  excellent: { label: "Excellent", glyph: "", description: "Almost as good as the best move." },
  good: { label: "Good", glyph: "", description: "A fine move." },
  inaccuracy: { label: "Inaccuracy", glyph: "?!", description: "A small slip." },
  mistake: { label: "Mistake", glyph: "?", description: "A clear error." },
  miss: { label: "Miss", glyph: "?", description: "A winning chance was missed." },
  blunder: { label: "Blunder", glyph: "??", description: "A serious error." },
};

/** Per tactic tag: the sentence of the move explanation, the label, and the hint shown on Insights. */
export const TAG_INFO: Record<TacticTag, { sentence: string; label: string; hint: string }> = {
  allowed_mate: { sentence: "It allowed a forced mate.", label: "Allowed mate", hint: "A move that let the opponent mate you" },
  missed_mate: { sentence: "It missed a forced mate.", label: "Missed mate", hint: "A mate you could have played" },
  hung_piece: { sentence: "It left a piece hanging.", label: "Hung piece", hint: "Left a piece to be captured for nothing" },
  allowed_tactic: { sentence: "It allowed a tactic that wins material.", label: "Allowed tactic", hint: "A move that allowed a winning tactic" },
  missed_tactic: { sentence: "It missed a tactic that wins material.", label: "Missed tactic", hint: "A winning tactic you did not play" },
  positional: { sentence: "No tactic involved: the position simply got worse.", label: "Positional", hint: "No tactical pattern behind the error" },
};

/** SAN immediately followed by the class's glyph: "Nxe5??", "Qh5!", "e4". */
export function annotatedSan(san: string, cls: MoveClass): string {
  return san + CLASS_INFO[cls].glyph;
}

/** "you" / "the opponent" (explanations) or "You" / "Opponent" (key moments) when my colour is known. */
function whomFor(mover: "w" | "b", myColour: "w" | "b" | undefined, capitalised: boolean): string {
  if (myColour === undefined) return mover === "w" ? "White" : "Black";
  if (mover === myColour) return capitalised ? "You" : "you";
  return capitalised ? "Opponent" : "the opponent";
}

const CLASSES_WITHOUT_BEST: MoveClass[] = ["book", "brilliant", "great", "best"];

export interface MoveExplanationInput {
  cls: MoveClass;
  tag?: TacticTag;
  moverWinPercentBefore: number;
  moverWinPercentAfter: number;
  mover: "w" | "b";
  myColour?: "w" | "b";
  /** The engine move's SAN, only when it can be played and differs from the move played. */
  bestSan?: string;
}

/** The move explanation shown under the board. */
export function buildMoveExplanation(input: MoveExplanationInput): string {
  const info = CLASS_INFO[input.cls];
  const symbol = info.glyph ? ` (${info.glyph})` : "";
  const sentences = [`${info.label}${symbol}. ${info.description}`];

  const whom = whomFor(input.mover, input.myColour, false);
  const before = Math.round(input.moverWinPercentBefore);
  const after = Math.round(input.moverWinPercentAfter);
  sentences.push(`Win chance for ${whom}: ${before}% → ${after}%.`);

  if (!CLASSES_WITHOUT_BEST.includes(input.cls) && input.bestSan !== undefined) {
    sentences.push(`Best was ${input.bestSan}.`);
  }

  if (input.tag) sentences.push(TAG_INFO[input.tag].sentence);

  return sentences.join(" ");
}

export interface KeyMomentSentenceInput {
  tag?: TacticTag;
  mover: "w" | "b";
  myColour?: "w" | "b";
  /** The move's SAN followed by its glyph, e.g. "Nf6??". */
  move: string;
  /** SAN of the first move of the best line of the position after the move, if it can be played. */
  replySan?: string;
  /** The piece the reply captures; "piece" if it captures nothing / is unknown. */
  replyPieceCaptured?: "pawn" | "knight" | "bishop" | "rook" | "queen" | "king" | "piece";
  /** The engine move's SAN, only when it can be played and differs from the move played. */
  bestSan?: string;
  /** Unrounded Win% points the mover lost with the move. */
  swing: number;
}

/** The key-moment sentence. */
export function buildKeyMomentSentence(input: KeyMomentSentenceInput): string {
  const subject = whomFor(input.mover, input.myColour, true);
  const swing = Math.round(input.swing);
  const best = input.bestSan;
  const bestClause = best !== undefined ? `; best was ${best}` : "";

  switch (input.tag) {
    case "allowed_mate":
      return input.replySan
        ? `${subject} played ${input.move} which allowed ${input.replySan} and a forced mate${bestClause}`
        : `${subject} played ${input.move} which allowed a forced mate${bestClause}`;
    case "hung_piece":
      return input.replySan
        ? `${subject} played ${input.move} which allowed ${input.replySan} winning the ${input.replyPieceCaptured}${bestClause}`
        : `${subject} played ${input.move} which left a piece hanging${bestClause}`;
    case "allowed_tactic":
      return input.replySan
        ? `${subject} played ${input.move} which allowed ${input.replySan} and a tactic winning material${bestClause}`
        : `${subject} played ${input.move} which allowed a tactic winning material${bestClause}`;
    case "missed_mate":
      return best !== undefined
        ? `${subject} played ${input.move} which missed a forced mate with ${best}`
        : `${subject} played ${input.move} which cost ${swing} points of winning chances`;
    case "missed_tactic":
      return best !== undefined
        ? `${subject} played ${input.move} which missed ${best} winning material`
        : `${subject} played ${input.move} which cost ${swing} points of winning chances`;
    default:
      return `${subject} played ${input.move} which cost ${swing} points of winning chances${bestClause}`;
  }
}
