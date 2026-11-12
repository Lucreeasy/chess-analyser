/**
 * Spaced repetition: only missed puzzles come back, after 1, 3 and 7 days; a solve at the last step, or on the
 * very first try, retires a puzzle. A day is exactly 24 hours.
 */
const DAY_MS = 86_400_000;
const STEPS = [1, 3, 7];

export interface Schedule {
  /** Undefined = retired (never due again). A new puzzle is due when it is created. */
  dueAt?: number;
  /** 0 = no step (new, or retired after a first-try solve), otherwise 1, 3 or 7. */
  intervalDays: number;
  attempts: number;
  lastResult?: "solved" | "missed";
}

/** A puzzle created at `now`: due at once. */
export const newSchedule = (now: number): Schedule => ({ dueAt: now, intervalDays: 0, attempts: 0 });

/** The schedule after one recorded attempt (an answer or a give-up; skips are not recorded). */
export function afterAttempt(s: Schedule, solved: boolean, now: number): Schedule {
  const attempts = s.attempts + 1;
  if (!solved) return { dueAt: now + DAY_MS, intervalDays: 1, attempts, lastResult: "missed" };
  const next = { ...s, attempts, lastResult: "solved" as const };
  if (s.attempts === 0) return { ...next, dueAt: undefined };
  // Practising a retired puzzle or one not yet due changes nothing but the history.
  if (s.dueAt === undefined || s.dueAt > now) return next;
  const step = STEPS[STEPS.indexOf(s.intervalDays) + 1];
  return step === undefined ? { ...next, dueAt: undefined } : { ...next, dueAt: now + step * DAY_MS, intervalDays: step };
}
