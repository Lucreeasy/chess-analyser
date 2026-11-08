/** Small builders for Insights tests: a stored game and an analysis with only the fields a test sets. */
import type { StoredGame } from "../../../src/server/import/parseGame.ts";
import type { GameAnalysis, MoveRecord } from "../../../src/server/analysis/game.ts";
import { ALL_CLASSES, type MoveClass } from "../../../src/server/analysis/classification.ts";

export function makeGame(fields: Partial<StoredGame> & { id: string }): StoredGame {
  return {
    source: "paste",
    pgn: "",
    tags: {},
    white: "me",
    black: "them",
    myColour: "w",
    result: "*",
    timeControlText: "180",
    timeClass: "blitz",
    playedAt: 0,
    plyCount: 0,
    importedAt: 0,
    analysisStatus: "none",
    ...fields,
  };
}

function zeroCounts(): Record<MoveClass, number> {
  return Object.fromEntries(ALL_CLASSES.map((c) => [c, 0])) as Record<MoveClass, number>;
}

/**
 * An analysis of a game I played as White, whose summary counts are derived from `moves` (both sides);
 * `myMoves` adds that many plain "good" moves of mine to the counts when a test only needs the move total.
 */
export function makeAnalysis(options: { moves?: Partial<MoveRecord>[]; myMoves?: number } = {}): GameAnalysis {
  const moves = (options.moves ?? []).map((m, i) => ({ ply: i + 1, colour: i % 2 === 0 ? "w" : "b", classification: "good", ...m }) as MoveRecord);
  const counts = { w: zeroCounts(), b: zeroCounts() };
  for (const m of moves) counts[m.colour][m.classification]++;
  counts.w.good += options.myMoves ?? 0;
  return {
    moves,
    summary: {
      engine: "test",
      depth: 16,
      analysedAt: 0,
      accuracy: { w: 80, b: 80 },
      counts,
      phaseAccuracy: { w: {}, b: {} },
      maxEp: { w: 0.5, b: 0.5 },
      minEp: { w: 0.5, b: 0.5 },
      keyMoments: [],
    },
  };
}
