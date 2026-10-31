import type { DepthPreset } from "../settings.ts";

/** Validates a request to queue games for analysis. docs/03-IMPORT-SPEC.md section 5.4 (exact messages). */

const DEPTH_PRESETS: readonly DepthPreset[] = ["quick", "standard", "deep"];

export interface QueueRequest {
  gameIds: string[];
  depth: DepthPreset | undefined;
  force: boolean;
  urgent: boolean;
}

export type ValidateQueueRequestResult = { ok: true; request: QueueRequest } | { ok: false; message: string };

/** `urgent` is not part of the request body; the caller decides it from the id count (section 5.4). */
export function validateQueueRequest(body: unknown): ValidateQueueRequestResult {
  if (typeof body !== "object" || body === null) return { ok: false, message: "JSON body required" };
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.gameIds) || b.gameIds.length === 0 || !b.gameIds.every((id) => typeof id === "string")) {
    return { ok: false, message: '"gameIds" must be a non-empty array of up to 10000 game ids' };
  }
  const gameIds = [...new Set(b.gameIds as string[])];
  if (gameIds.length > 10_000) return { ok: false, message: '"gameIds" must be a non-empty array of up to 10000 game ids' };

  let depth: DepthPreset | undefined;
  if (b.depth !== undefined) {
    if (!DEPTH_PRESETS.includes(b.depth as DepthPreset)) return { ok: false, message: '"depth" must be one of quick, standard, deep' };
    depth = b.depth as DepthPreset;
  }

  if (b.force !== undefined && typeof b.force !== "boolean") return { ok: false, message: '"force" must be a boolean' };

  return { ok: true, request: { gameIds, depth, force: b.force === true, urgent: gameIds.length <= 5 } };
}

/** The exact "some ids are not stored games" message. */
export function unknownIdsMessage(unknownIds: string[]): string {
  return `unknown game ids (${unknownIds.length}): ${unknownIds.slice(0, 3).join(", ")}`;
}
