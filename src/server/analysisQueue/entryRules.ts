import type { DepthPreset } from "../settings.ts";

/** Deciding what to do with one game id in a queue request. */

export type GameAnalysisState = "running" | "waiting" | "done" | "error" | "none";

export interface QueueValues {
  depth: DepthPreset;
  force: boolean;
  urgent: boolean;
}

const DEPTH_ORDER: Record<DepthPreset, number> = { quick: 0, standard: 1, deep: 2 };

/** The higher depth wins; force/urgent are OR'd. Depth is never lowered. */
export function mergeQueueValues(existing: QueueValues | undefined, requested: QueueValues): QueueValues {
  if (!existing) return requested;
  return {
    depth: DEPTH_ORDER[existing.depth] >= DEPTH_ORDER[requested.depth] ? existing.depth : requested.depth,
    force: existing.force || requested.force,
    urgent: existing.urgent || requested.urgent,
  };
}

/**
 * Whether a game should be (re-)queued: a running game is left alone; a
 * done game is skipped unless the request forces it; every other state
 * (waiting, error, none) is queued (a waiting entry is merged/upgraded,
 * not duplicated).
 */
export function shouldQueue(state: GameAnalysisState, force: boolean): boolean {
  if (state === "running") return false;
  if (state === "done") return force;
  return true;
}
