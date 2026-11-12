/**
 * Move classification: the ten classes, decided by the first matching rule in precedence order. All
 * comparisons use a 1e-9 tolerance.
 */

export type MoveClass =
  | "book"
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "miss"
  | "blunder";

/** Table order everywhere. */
export const ALL_CLASSES: MoveClass[] = [
  "book", "brilliant", "great", "best", "excellent", "good", "inaccuracy", "mistake", "miss", "blunder",
];

/** The four error classes, in display order. */
export const ERROR_CLASSES = ["inaccuracy", "mistake", "miss", "blunder"] as const satisfies readonly MoveClass[];
export type ErrorClass = (typeof ERROR_CLASSES)[number];

export function isError(cls: MoveClass): cls is ErrorClass {
  return (ERROR_CLASSES as readonly MoveClass[]).includes(cls);
}

export interface ClassificationInput {
  playedUci: string;
  /** First move of the best line of the position before; undefined if the engine move is unknown. */
  engineUci?: string;
  epBefore: number;
  epAfter: number;
  /** Raw (not tolerance-adjusted). */
  epLoss: number;
  /** Mover-POV EP of line 2 of the position before; absent when there is no second line. */
  epOfLine2?: number;
  isBook: boolean;
  /** The class of the previous ply, only when it exists and was played by the other colour. */
  previousOpponentClass?: MoveClass;
  isRecapture: boolean;
  isPromotion: boolean;
  /** Only evaluated by the caller when it can affect the result. */
  isSacrifice: boolean;
}

const TOLERANCE = 1e-9;
const geq = (a: number, b: number) => a >= b - TOLERANCE;
const leq = (a: number, b: number) => a <= b + TOLERANCE;
const gt = (a: number, b: number) => a > b + TOLERANCE;
const lt = (a: number, b: number) => a < b - TOLERANCE;

export function classifyMove(input: ClassificationInput): MoveClass {
  if (input.isBook) return "book";

  const isEngineMove = input.engineUci !== undefined && input.playedUci === input.engineUci;

  if (
    !input.isRecapture &&
    !input.isPromotion &&
    leq(input.epLoss, 0.02) &&
    geq(input.epAfter, 0.5) &&
    lt(input.epBefore, 0.95) &&
    input.isSacrifice
  ) {
    return "brilliant";
  }

  if (isEngineMove && input.epOfLine2 !== undefined) {
    const gap = input.epBefore - input.epOfLine2;
    if (geq(gap, 0.15) && gt(input.epBefore, 0.1) && lt(input.epBefore, 0.95)) return "great";
  }

  if (isEngineMove) return "best";

  const previousWasError = input.previousOpponentClass === "mistake" || input.previousOpponentClass === "blunder";
  if (
    previousWasError &&
    !isEngineMove &&
    geq(input.epBefore, 0.7) &&
    geq(input.epLoss, 0.1) &&
    !(geq(input.epLoss, 0.2) && lt(input.epAfter, 0.5))
  ) {
    return "miss";
  }

  if (lt(input.epLoss, 0.02)) return "excellent";
  if (lt(input.epLoss, 0.05)) return "good";
  if (lt(input.epLoss, 0.1)) return "inaccuracy";
  if (lt(input.epLoss, 0.2)) return "mistake";
  return "blunder";
}
