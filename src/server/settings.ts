import { isValidUsername } from "./chesscom/parsing.ts";
import { DEPTH_PRESETS } from "./analysisQueue/depthPresets.ts";

/** Settings that affect import and analysis. */

export type DepthPreset = "quick" | "standard" | "deep";

export interface Settings {
  usernames: string[];
  depthPreset: DepthPreset;
  autoAnalyse: boolean;
  /** Hours between automatic chess.com syncs; 0 = off. */
  autoSyncHours: number;
}

export const DEFAULT_SETTINGS: Settings = { usernames: [], depthPreset: "standard", autoAnalyse: true, autoSyncHours: 6 };
export const AUTO_SYNC_HOURS = [0, 1, 3, 6, 12, 24];

export const MAX_USERNAMES = 10;

export type ValidateSettingsResult = { ok: true; settings: Settings } | { ok: false; message: string };

/**
 * Validates a settings update against the current settings: fields not
 * present in `body` keep their current value. `usernames`, when present,
 * is trimmed, lower-cased and de-duplicated before the per-name and
 * count checks (with the exact messages the Settings screen shows).
 */
export function validateSettingsUpdate(body: unknown, current: Settings): ValidateSettingsResult {
  if (typeof body !== "object" || body === null) return { ok: false, message: "JSON body required" };
  const b = body as Record<string, unknown>;

  let usernames = current.usernames;
  if (b.usernames !== undefined) {
    if (!Array.isArray(b.usernames) || !b.usernames.every((name) => typeof name === "string")) {
      return { ok: false, message: "usernames must be a string array" };
    }
    const deduped: string[] = [];
    for (const raw of b.usernames as string[]) {
      const name = raw.trim().toLowerCase();
      if (!deduped.includes(name)) deduped.push(name);
    }
    for (const name of deduped) {
      if (!isValidUsername(name)) {
        return { ok: false, message: `"${name.slice(0, 40)}" is not a chess.com username (3-25 letters, digits, "_" or "-")` };
      }
    }
    if (deduped.length > MAX_USERNAMES) return { ok: false, message: `at most ${MAX_USERNAMES} usernames` };
    usernames = deduped;
  }

  let depthPreset = current.depthPreset;
  if (b.depthPreset !== undefined) {
    if (!DEPTH_PRESETS.includes(b.depthPreset as DepthPreset)) return { ok: false, message: "unknown depthPreset" };
    depthPreset = b.depthPreset as DepthPreset;
  }

  const autoAnalyse = b.autoAnalyse !== undefined ? Boolean(b.autoAnalyse) : current.autoAnalyse;

  let autoSyncHours = current.autoSyncHours;
  if (b.autoSyncHours !== undefined) {
    if (!AUTO_SYNC_HOURS.includes(b.autoSyncHours as number)) return { ok: false, message: `autoSyncHours must be one of ${AUTO_SYNC_HOURS.join(", ")}` };
    autoSyncHours = b.autoSyncHours as number;
  }

  return { ok: true, settings: { usernames, depthPreset, autoAnalyse, autoSyncHours } };
}
