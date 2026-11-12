import { parseTimeControl } from "../analysis/clock.ts";

/** Time control and time class. */

export type TimeClass = "bullet" | "blitz" | "rapid" | "daily" | "classical";

export const ALL_TIME_CLASSES: readonly TimeClass[] = ["bullet", "blitz", "rapid", "daily", "classical"];

/** The trimmed TimeControl tag, or "-" if missing/empty. */
export function timeControlText(tagValue: string | undefined): string {
  const trimmed = (tagValue ?? "").trim();
  return trimmed === "" ? "-" : trimmed;
}

export function classifyTimeControl(tagValue: string | undefined): TimeClass {
  const control = parseTimeControl(timeControlText(tagValue));
  if (control.kind === "daily") return "daily";
  if (control.kind === "unknown") return "classical";

  const duration = control.baseMs / 1000 + (40 * control.incrementMs) / 1000;
  if (duration < 180) return "bullet";
  if (duration < 600) return "blitz";
  if (duration < 3600) return "rapid";
  return "classical";
}
