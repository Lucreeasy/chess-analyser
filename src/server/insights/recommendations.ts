/**
 * Up to five recommendations from patterns across the used games. docs/04-INSIGHTS-SPEC.md section 13.
 */
import type { MoveRecord } from "../analysis/game.ts";
import { isError } from "../analysis/classification.ts";
import type { TacticTag } from "../analysis/tacticTags.ts";
import type { Phase } from "../analysis/phases.ts";
import { myMoves, type Overview } from "./overview.ts";
import type { TimeStats } from "./time.ts";
import type { UsedGame } from "./select.ts";

export interface Evidence {
  gameId: string;
  ply: number;
}

export interface Recommendation {
  id: string;
  title: string;
  finding: string;
  why: string;
  action: string;
  evidence: Evidence[];
  severity: number;
  practice?: { tag?: TacticTag; phase?: Phase; label: string };
}

/** What the rules read: the used games and the sections computed from them. */
export interface RuleInputs {
  used: UsedGame[];
  overview: Overview;
  time: TimeStats;
}

const MAX_EVIDENCE = 5;
const MAX_SHOWN = 5;

// Section 13.1: severity.
const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
export const depth = (excess: number, scale: number) => clamp01(excess / scale);
export const support = (n: number, fullAt: number) => clamp01(n / fullAt);
export const severity = (weight: number, d: number, s: number) => Math.round(25 + 75 * weight * (0.7 * d + 0.3 * s));
export const positiveSeverity = (d: number, s: number) => Math.round(5 + 15 * (0.7 * d + 0.3 * s));

// Text formats (section 0).
const pct = (x: number) => `${Math.round(x * 100)}%`;
const one = (x: number) => x.toFixed(1);

interface Candidate extends Evidence {
  score: number;
}

/** Section 13.1 evidence choice: best first; by default the best of each game first, then the rest. */
export function chooseEvidence(candidates: Candidate[], onePerGameFirst = true): Evidence[] {
  const sorted = [...candidates].sort(
    (a, b) => b.score - a.score || (a.gameId < b.gameId ? -1 : a.gameId > b.gameId ? 1 : 0) || a.ply - b.ply,
  );
  const chosen: Candidate[] = [];
  if (onePerGameFirst) {
    const games = new Set<string>();
    for (const c of sorted) {
      if (chosen.length < MAX_EVIDENCE && !games.has(c.gameId)) {
        games.add(c.gameId);
        chosen.push(c);
      }
    }
  }
  for (const c of sorted) if (chosen.length < MAX_EVIDENCE && !chosen.includes(c)) chosen.push(c);
  return chosen.map(({ gameId, ply }) => ({ gameId, ply }));
}

/** My moves of the used games that pass `keep`, scored. */
function candidates(used: UsedGame[], score: (m: MoveRecord) => number | undefined): Candidate[] {
  return used.flatMap((u) =>
    myMoves(u).flatMap((m) => {
      const s = score(m);
      return s === undefined ? [] : [{ gameId: u.game.id, ply: m.ply, score: s }];
    }),
  );
}

/** Section 13.2. */
function blunderCheck({ used, overview }: RuleInputs): Recommendation | undefined {
  if (overview.moves < 300) return undefined;
  const hung = overview.tactics.hung_piece;
  const tagTrigger = overview.topTag === "hung_piece" && hung.n >= 10 && hung.count! >= 5;
  const rate = overview.errors.blunder.value!;
  const rateTrigger = rate >= 1.5;
  if (!tagTrigger && !rateTrigger) return undefined;
  const d = Math.max(tagTrigger ? depth(hung.value! - 0.25, 0.35) : 0, rateTrigger ? depth(rate - 1.5, 2) : 0);
  let evidence = candidates(used, (m) =>
    m.classification === "blunder" || (isError(m.classification) && m.tag === "hung_piece")
      ? m.epLoss + (m.tag === "hung_piece" ? 1 : 0) + (m.classification === "blunder" ? 0.5 : 0)
      : undefined,
  );
  if (evidence.length === 0) evidence = candidates(used, (m) => (isError(m.classification) ? m.epLoss : undefined));
  return {
    id: "blunder-check",
    title: "Check for hanging pieces before every move",
    finding: tagTrigger
      ? `Leaving a piece unprotected is your most common kind of mistake: ${hung.count} of your ${hung.n} tagged errors (${pct(hung.value!)}), and you blunder ${one(rate)} times per 100 moves.`
      : `You blunder ${one(rate)} times per 100 moves (${overview.errors.blunder.count} blunders in ${overview.moves} moves).`,
    why: "At club level one piece left unprotected often decides the game, and this habit is cheaper to fix than any opening or endgame knowledge.",
    action:
      "Before every move, ask what your opponent's last move attacks and whether each of your pieces is protected. Then practise with puzzles made from your own blunders.",
    evidence: chooseEvidence(evidence),
    severity: severity(1, d, support(overview.moves, 1500)),
    practice: { tag: tagTrigger ? "hung_piece" : undefined, label: "Puzzles from your own blunders" },
  };
}

/** Section 13.3. */
function timeTrouble({ used, time }: RuleInputs): Recommendation | undefined {
  const { troubleBlunders: trouble, normalBlunders: normal, gamesInTrouble } = time;
  const ratioTrigger =
    trouble.value !== undefined &&
    normal.value !== undefined &&
    trouble.n >= 20 &&
    trouble.count! >= 2 &&
    trouble.value > 0 &&
    trouble.value >= 2 * normal.value;
  const shareTrigger = time.clocked.length >= 10 && gamesInTrouble.value! >= 0.15;
  if (!ratioTrigger && !shareTrigger) return undefined;
  const ratio = ratioTrigger && normal.value! > 0 ? trouble.value! / normal.value! : undefined;
  const ratioDepth = !ratioTrigger ? 0 : ratio === undefined ? 1 : depth(ratio - 2, 4);
  const shareDepth = shareTrigger ? depth(gamesInTrouble.value! - 0.15, 0.35) : 0;

  const troubleShare = pct(gamesInTrouble.value ?? 0);
  const timedGames = time.clocked.length;
  let finding: string;
  if (ratioTrigger && (shareTrigger || ratio === undefined)) {
    finding = `You ran short of time in ${troubleShare} of your ${timedGames} games with clocks, and you blunder ${one(trouble.value!)} times per 100 moves in time trouble against ${one(normal.value!)} otherwise.`;
  } else if (ratioTrigger) {
    finding = `You blunder ${one(trouble.value!)} times per 100 moves when short of time, ${one(ratio!)} times your normal rate of ${one(normal.value!)} (over ${trouble.n} moves).`;
  } else {
    finding = `You ran short of time in ${troubleShare} of your ${timedGames} games with clocks (${gamesInTrouble.count} games).`;
  }
  const advice =
    "Play the opening faster, from memory or simple principles, and keep that time for the critical middlegame moves. Where you can, choose time controls with an increment, for example 3+2 or 10+5.";
  const early = time.secondsPerMoveEarly.value;
  return {
    id: "time-trouble",
    title: "Keep more time for the later moves",
    finding,
    why: "Short on time, quick decisions turn into blunders, and positions you could win or hold get thrown away.",
    action: early === undefined ? advice : `You spend ${one(early)} s per move on average in your first 10 moves. ${advice}`,
    evidence: chooseEvidence(candidates(used, (m) => (m.inTimeTrouble ? m.epLoss + (m.classification === "blunder" ? 1 : 0) : undefined))),
    severity: severity(0.95, Math.max(ratioDepth, shareDepth), support(timedGames, 60)),
  };
}

const RULES = [blunderCheck, timeTrouble];

/** Section 13.1 "running the rules": evidence de-duplicated and capped, then the top 5 by severity. */
export function recommendations(inputs: RuleInputs): Recommendation[] {
  return RULES.map((rule) => rule(inputs))
    .filter((r) => r !== undefined)
    .map((r) => ({
      ...r,
      evidence: r.evidence.filter((e, i) => r.evidence.findIndex((f) => f.gameId === e.gameId && f.ply === e.ply) === i).slice(0, MAX_EVIDENCE),
    }))
    .filter((r) => r.evidence.length > 0)
    .sort((a, b) => b.severity - a.severity || (a.id < b.id ? -1 : 1))
    .slice(0, MAX_SHOWN);
}
