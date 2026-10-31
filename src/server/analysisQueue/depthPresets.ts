import type { DepthPreset } from "../settings.ts";

/** Search depth per preset. docs/03-IMPORT-SPEC.md section 5.3. */
export const SEARCH_DEPTH: Record<DepthPreset, 12 | 16 | 20> = { quick: 12, standard: 16, deep: 20 };

/** "Re-analyse deeper" (section 5.5): one step above, capped at deep. */
export function oneStepDeeper(preset: DepthPreset): DepthPreset {
  if (preset === "quick") return "standard";
  return "deep";
}
