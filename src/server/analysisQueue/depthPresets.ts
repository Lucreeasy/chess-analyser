import type { DepthPreset } from "../settings.ts";

export const DEPTH_PRESETS: readonly DepthPreset[] = ["quick", "standard", "deep"];

/** Search depth per preset. */
export const SEARCH_DEPTH: Record<DepthPreset, 12 | 16 | 20> = { quick: 12, standard: 16, deep: 20 };

export const DEPTH_LABEL: Record<DepthPreset, string> = { quick: "Quick", standard: "Standard", deep: "Deep" };

/** "Re-analyse deeper": one step above, capped at deep. */
export function oneStepDeeper(preset: DepthPreset): DepthPreset {
  if (preset === "quick") return "standard";
  return "deep";
}
