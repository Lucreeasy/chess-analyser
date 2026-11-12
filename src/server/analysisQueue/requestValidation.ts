import type { DepthPreset } from "../settings.ts";

/**
 * Validates requests to queue or delete games, with the exact error messages the interface shows.
 */

const DEPTH_PRESETS: readonly DepthPreset[] = ["quick", "standard", "deep"];
const MAX_IDS = 10_000;

/** A non-empty, de-duplicated array of up to `MAX_IDS` strings under `fieldName`. */
function validateIdsField(value: unknown, fieldName: string): { ok: true; ids: string[] } | { ok: false; message: string } {
  const invalid = { ok: false as const, message: `"${fieldName}" must be a non-empty array of up to ${MAX_IDS} game ids` };
  if (!Array.isArray(value) || value.length === 0 || !value.every((id) => typeof id === "string")) return invalid;
  const ids = [...new Set(value as string[])];
  if (ids.length > MAX_IDS) return invalid;
  return { ok: true, ids };
}

export interface QueueRequest {
  gameIds: string[];
  depth: DepthPreset | undefined;
  force: boolean;
  urgent: boolean;
  /** "Re-analyse deeper": force on, depth one step above the saved default. */
  deeper: boolean;
}

export type ValidateQueueRequestResult = { ok: true; request: QueueRequest } | { ok: false; message: string };

/** `urgent` is not part of the request body; the caller decides it from the id count. */
export function validateQueueRequest(body: unknown): ValidateQueueRequestResult {
  if (typeof body !== "object" || body === null) return { ok: false, message: "JSON body required" };
  const b = body as Record<string, unknown>;

  const ids = validateIdsField(b.gameIds, "gameIds");
  if (!ids.ok) return ids;

  let depth: DepthPreset | undefined;
  if (b.depth !== undefined) {
    if (!DEPTH_PRESETS.includes(b.depth as DepthPreset)) return { ok: false, message: '"depth" must be one of quick, standard, deep' };
    depth = b.depth as DepthPreset;
  }

  if (b.force !== undefined && typeof b.force !== "boolean") return { ok: false, message: '"force" must be a boolean' };
  if (b.deeper !== undefined && typeof b.deeper !== "boolean") return { ok: false, message: '"deeper" must be a boolean' };

  const deeper = b.deeper === true;
  return { ok: true, request: { gameIds: ids.ids, depth, force: b.force === true || deeper, urgent: ids.ids.length <= 5, deeper } };
}

/** The exact "some ids are not stored games" message. */
export function unknownIdsMessage(unknownIds: string[]): string {
  return `unknown game ids (${unknownIds.length}): ${unknownIds.slice(0, 3).join(", ")}`;
}

export type ValidateDeleteRequestResult = { ok: true; ids: string[] } | { ok: false; message: string };

/** 1 to 10000 ids under "ids" (not "gameIds"). */
export function validateDeleteRequest(body: unknown): ValidateDeleteRequestResult {
  if (typeof body !== "object" || body === null) return { ok: false, message: "JSON body required" };
  return validateIdsField((body as Record<string, unknown>).ids, "ids");
}
