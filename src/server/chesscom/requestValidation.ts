import { isValidUsername, isValidMonth } from "./parsing.ts";
import { ALL_TIME_CLASSES, type TimeClass } from "../import/timeClass.ts";

/** Validates a manual chess.com import request. docs/03-IMPORT-SPEC.md section 3.2 (exact messages). */

export interface ImportRequest {
  username: string;
  from: string;
  to: string;
  timeClasses: Set<TimeClass>;
}

export type ValidateResult = { ok: true; request: ImportRequest } | { ok: false; status: number; message: string };

export function validateImportRequest(body: unknown): ValidateResult {
  if (typeof body !== "object" || body === null) return { ok: false, status: 400, message: "JSON body required" };
  const b = body as Record<string, unknown>;

  if (typeof b.username !== "string" || !isValidUsername(b.username)) {
    return { ok: false, status: 400, message: 'username must be 3-25 letters, digits, "_" or "-"' };
  }

  if (typeof b.from !== "string" || typeof b.to !== "string" || !isValidMonth(b.from) || !isValidMonth(b.to)) {
    return { ok: false, status: 400, message: '"from" and "to" must be months like "2026-09"' };
  }
  if (b.from > b.to) return { ok: false, status: 400, message: '"from" must not be after "to"' };

  if (
    !Array.isArray(b.timeClasses) ||
    b.timeClasses.length === 0 ||
    !b.timeClasses.every((c) => ALL_TIME_CLASSES.includes(c as TimeClass))
  ) {
    return {
      ok: false,
      status: 400,
      message: '"timeClasses" must be a non-empty list of: bullet, blitz, rapid, daily, classical',
    };
  }

  return {
    ok: true,
    request: { username: b.username.trim().toLowerCase(), from: b.from, to: b.to, timeClasses: new Set(b.timeClasses as TimeClass[]) },
  };
}
