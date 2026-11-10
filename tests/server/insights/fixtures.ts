/**
 * Builders for Insights tests: a stored game and an analysis with only the fields a test sets, and a seeded
 * library of realistic analysed games. As a command it writes that library into a database, for looking at
 * the Insights screen without analysing anything:  node tests/server/insights/fixtures.ts data/games.db [count]
 */
import { Chess } from "chess.js";
import type { StoredGame } from "../../../src/server/import/parseGame.ts";
import type { GameAnalysis, MoveRecord } from "../../../src/server/analysis/game.ts";
import type { GameWithAnalysis, UsedGame } from "../../../src/server/insights/select.ts";
import type { TacticTag } from "../../../src/server/analysis/tacticTags.ts";
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
 * An analysis of a game I played as `me` (default White), whose summary counts are derived from `moves` (both
 * sides); `myMoves` adds that many plain "good" moves of mine to the counts when a test only needs the move total.
 */
export function makeAnalysis(
  options: { me?: "w" | "b"; moves?: Partial<MoveRecord>[]; myMoves?: number; accuracy?: number; maxEp?: number; minEp?: number } = {},
): GameAnalysis {
  const me = options.me ?? "w";
  const mine = <T,>(mineValue: T, other: T) => (me === "w" ? { w: mineValue, b: other } : { w: other, b: mineValue });
  const moves = (options.moves ?? []).map((m, i) => ({ ply: i + 1, colour: i % 2 === 0 ? "w" : "b", classification: "good", ...m }) as MoveRecord);
  const counts = { w: zeroCounts(), b: zeroCounts() };
  for (const m of moves) counts[m.colour][m.classification]++;
  counts[me].good += options.myMoves ?? 0;
  return {
    moves,
    summary: {
      engine: "test",
      depth: 16,
      analysedAt: 0,
      accuracy: mine(options.accuracy ?? 80, 80),
      counts,
      phaseAccuracy: { w: {}, b: {} },
      maxEp: mine(options.maxEp ?? 0.5, 0.5),
      minEp: mine(options.minEp ?? 0.5, 0.5),
      keyMoments: [],
    },
  };
}

/** A used game (me = White) for metric tests; `moves` alternate White, Black unless a colour is given. */
export function used(id: string, options: Parameters<typeof makeAnalysis>[0] & { game?: Partial<StoredGame> } = {}): UsedGame {
  return { game: makeGame({ id, ...options.game }), analysis: makeAnalysis(options), me: "w" };
}

/** mulberry32: a small seeded PRNG, so every run builds the same games. */
function prng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FAMILIES = ["Sicilian Defense", "French Defense", "Queen's Gambit", "Scandinavian Defense", "Italian Game", undefined];
const OPPONENTS = ["Bagrat1on", "Parakon1", "gurelediz", "dmitrijiIM", "BilodeauA", "NikoTheodorou"];
const TAGS: TacticTag[] = ["hung_piece", "hung_piece", "allowed_tactic", "missed_tactic", "positional", "positional", "missed_mate"];

function classify(loss: number, rand: number): MoveClass {
  if (loss >= 0.2) return "blunder";
  if (loss >= 0.1) return rand < 0.3 ? "miss" : "mistake";
  if (loss >= 0.05) return "inaccuracy";
  if (loss >= 0.02) return "good";
  if (loss > 0.005) return "excellent";
  return rand < 0.05 ? "great" : "best";
}

/**
 * `count` analysed 3-minute games from 1 Sept 2026 on: real legal random moves (the style features read them)
 * with a synthetic evaluation walk, and classes, phases, tags and clocks derived from it.
 */
export function seededGames(count = 60, seed = 7): GameWithAnalysis[] {
  const rand = prng(seed);
  let playedAt = Date.UTC(2026, 8, 1, 18);
  return Array.from({ length: count }, (_, g) => {
    playedAt += rand() < 0.4 ? 20 * 60_000 : Math.round((6 + rand() * 30) * 3_600_000);
    const me = g % 2 === 0 ? "w" : "b";
    const skill = 0.55 + rand() * 0.4; // per game: how cleanly I play
    const chess = new Chess();
    const plies = 40 + Math.floor(rand() * 50);
    const moves: Partial<MoveRecord>[] = [];
    const clock = { w: 180_000, b: 180_000 };
    let white = 50;
    for (let ply = 1; ply <= plies; ply++) {
      const legal = chess.moves();
      if (legal.length === 0) break;
      const fenBefore = chess.fen();
      const move = chess.move(legal[Math.floor(rand() * legal.length)]);
      const colour = move.color;
      const loss = ply <= 8 ? 0 : rand() < (colour === me ? skill : 0.75) ? rand() * 0.02 : rand() * rand() * 0.45;
      const before = white;
      white = Math.min(99, Math.max(1, white + (colour === "w" ? 1 : -1) * (rand() * 0.03 - loss) * 100));
      const spent = Math.round((ply < 20 ? 1 : 2 + rand() * 6) * 1000);
      clock[colour] = Math.max(1000, clock[colour] - spent);
      const classification = ply <= 8 ? "book" : classify(loss, rand());
      const isError = ["inaccuracy", "mistake", "miss", "blunder"].includes(classification);
      moves.push({
        colour,
        san: move.san,
        uci: move.lan,
        fenBefore,
        winPercentBefore: before,
        winPercentAfter: white,
        epLoss: loss,
        accuracy: Math.max(0, 100 - loss * 250),
        classification,
        tag: isError ? TAGS[Math.floor(rand() * TAGS.length)] : undefined,
        phase: ply <= 20 ? "opening" : ply > plies - 16 ? "endgame" : "middlegame",
        clockMs: clock[colour],
        timeSpentMs: spent,
        inTimeTrouble: clock[colour] < 18_000,
      });
    }
    const eps = [0.5, ...moves.map((m) => (me === "w" ? m.winPercentAfter! : 100 - m.winPercentAfter!) / 100)];
    const final = eps[eps.length - 1];
    const myResult = final > 0.7 ? "win" : final < 0.3 ? "loss" : rand() < 0.5 ? "draw" : final >= 0.5 ? "win" : "loss";
    const mineMoves = moves.filter((m) => m.colour === me);
    const opponent = OPPONENTS[g % OPPONENTS.length];
    return {
      game: makeGame({
        id: `seed-${String(g).padStart(3, "0")}`,
        white: me === "w" ? "me" : opponent,
        black: me === "b" ? "me" : opponent,
        whiteElo: me === "w" ? 1500 + g * 2 : 1520,
        blackElo: me === "b" ? 1500 + g * 2 : 1520,
        myColour: me,
        result: myResult === "draw" ? "1/2-1/2" : (myResult === "win") === (me === "w") ? "1-0" : "0-1",
        myResult,
        termination: myResult === "loss" && clock[me] <= 1000 ? "time" : "resignation",
        timeClass: g % 5 === 0 ? "rapid" : "blitz",
        playedAt,
        importedAt: playedAt,
        openingFamily: FAMILIES[Math.floor(rand() * FAMILIES.length)],
        plyCount: moves.length,
      }),
      analysis: makeAnalysis({
        me,
        moves,
        accuracy: mineMoves.reduce((s, m) => s + m.accuracy!, 0) / mineMoves.length,
        maxEp: Math.max(...eps),
        minEp: Math.min(...eps),
      }),
    };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { openDb, insertGames, finishAnalysis } = await import("../../../src/server/db.ts");
  const db = openDb(process.argv[2] ?? "data/games.db");
  const games = seededGames(Number(process.argv[3] ?? 60));
  insertGames(db, games.map((g) => g.game));
  for (const g of games) finishAnalysis(db, g.game.id, "standard", g.analysis!, g.game.playedAt);
  console.log(`seeded ${games.length} analysed games`);
}
