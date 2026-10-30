import type { EngineLineWithPv } from "../analysis/tacticTags.ts";

export interface ParsedInfo {
  depth: number;
  multipv: number;
  cp?: number;
  mate?: number;
  pv: string[];
}

/** Parses one "info ..." line; null if it has no score, no pv, or a bound score. docs/02-ANALYSIS-SPEC.md 2.4. */
export function parseInfoLine(line: string): ParsedInfo | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== "info") return null;

  let depth: number | undefined;
  let multipv = 1;
  let cp: number | undefined;
  let mate: number | undefined;
  let bound = false;
  let pv: string[] | undefined;

  for (let i = 1; i < tokens.length; i++) {
    switch (tokens[i]) {
      case "depth":
        depth = Number(tokens[++i]);
        break;
      case "multipv":
        multipv = Number(tokens[++i]);
        break;
      case "score":
        if (tokens[i + 1] === "cp") cp = Number(tokens[(i += 2)]);
        else if (tokens[i + 1] === "mate") mate = Number(tokens[(i += 2)]);
        if (tokens[i + 1] === "lowerbound" || tokens[i + 1] === "upperbound") {
          bound = true;
          i++;
        }
        break;
      case "pv":
        pv = tokens.slice(i + 1);
        i = tokens.length;
        break;
    }
  }

  if (depth === undefined || pv === undefined || pv.length === 0 || bound) return null;
  if (cp === undefined && mate === undefined) return null;
  return { depth, multipv, cp, mate, pv };
}

/** Parses "bestmove <uci> [ponder <uci>]"; null if it is not that line. */
export function parseBestmoveLine(line: string): string | null {
  const match = /^bestmove\s+(\S+)/.exec(line.trim());
  return match ? match[1] : null;
}

function toWhitePov(info: ParsedInfo, sideToMove: "w" | "b"): EngineLineWithPv {
  const sign = sideToMove === "b" ? -1 : 1;
  const cp = info.cp !== undefined ? (info.cp * sign === 0 ? 0 : info.cp * sign) : undefined;
  const mate = info.mate !== undefined ? info.mate * sign : undefined;
  return mate !== undefined ? { mate, pv: info.pv } : { cp, pv: info.pv };
}

/**
 * Reduces a search's "info" lines to an ordered list of engine lines (section 2.4): for each
 * (depth, slot) keep the latest line; take the deepest depth with every slot 1..S present, or
 * (if none is complete) the deepest depth with slot 1, up to its first missing slot.
 */
export function reduceInfoLines(
  infos: ParsedInfo[],
  sideToMove: "w" | "b",
): { lines: EngineLineWithPv[]; reachedDepth: number } {
  const bySlotThenDepth = new Map<number, Map<number, ParsedInfo>>();
  let highestSlotSeen = 1;
  for (const info of infos) {
    highestSlotSeen = Math.max(highestSlotSeen, info.multipv);
    if (!bySlotThenDepth.has(info.multipv)) bySlotThenDepth.set(info.multipv, new Map());
    bySlotThenDepth.get(info.multipv)!.set(info.depth, info); // later lines overwrite earlier ones at the same depth
  }

  const depths = [...(bySlotThenDepth.get(1)?.keys() ?? [])].sort((a, b) => b - a);
  for (const depth of depths) {
    const slots: ParsedInfo[] = [];
    for (let slot = 1; slot <= highestSlotSeen; slot++) {
      const info = bySlotThenDepth.get(slot)?.get(depth);
      if (!info) break;
      slots.push(info);
    }
    if (slots.length === highestSlotSeen) {
      return { lines: slots.map((s) => toWhitePov(s, sideToMove)), reachedDepth: depth };
    }
  }
  // No depth is complete: the deepest depth with slot 1, up to its first missing slot.
  const deepestWithSlot1 = depths[0];
  if (deepestWithSlot1 === undefined) return { lines: [], reachedDepth: 0 };
  const slots: ParsedInfo[] = [];
  for (let slot = 1; slot <= highestSlotSeen; slot++) {
    const info = bySlotThenDepth.get(slot)?.get(deepestWithSlot1);
    if (!info) break;
    slots.push(info);
  }
  return { lines: slots.map((s) => toWhitePov(s, sideToMove)), reachedDepth: deepestWithSlot1 };
}
