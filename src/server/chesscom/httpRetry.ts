/**
 * Generic retry/backoff over one HTTP-ish attempt.
 * Independent of chess.com's URLs/parsing so it is
 * testable with a scripted sequence of outcomes and no real timers.
 */

export type AttemptKind = "ok" | "not_found" | "rate_limited" | "server_error" | "other_status" | "network_error" | "timeout";

export interface AttemptOutcome {
  kind: AttemptKind;
  /** Only meaningful for "rate_limited": the Retry-After hint, in seconds, if chess.com sent one. */
  retryAfterSeconds?: number;
}

export type Attempt<T extends AttemptOutcome> = () => Promise<T>;

export interface RetryResult<T extends AttemptOutcome> {
  outcome: T;
  attempts: number;
}

const BACKOFF_MS = [2000, 4000, 8000]; // doubling from 2s
const NEXT_BACKOFF_SECONDS = 16; // the "last backoff estimate" once retries are exhausted

/**
 * Retries an attempt up to `maxRetries` times after the first (3 in use). Not retried: ok, not_found, other_status. Retried with the
 * doubling backoff: network_error, timeout, server_error, and rate_limited
 * without a usable hint. Retried with the hint's own wait: rate_limited
 * with a hint of at most 120s. A hint over 120s stops immediately.
 */
export async function withRetry<T extends AttemptOutcome>(
  attempt: Attempt<T>,
  maxRetries: number,
  wait: (ms: number) => Promise<void>,
): Promise<RetryResult<T>> {
  let outcome: T;
  for (let i = 0; i <= maxRetries; i++) {
    outcome = await attempt();
    const isLastTry = i === maxRetries;

    if (outcome.kind === "ok" || outcome.kind === "not_found" || outcome.kind === "other_status") {
      return { outcome, attempts: i + 1 };
    }

    if (outcome.kind === "rate_limited") {
      const hint = outcome.retryAfterSeconds;
      if (hint !== undefined && hint > 120) return { outcome, attempts: i + 1 }; // too long: fail now
      if (isLastTry) {
        return { outcome: { ...outcome, retryAfterSeconds: hint ?? NEXT_BACKOFF_SECONDS }, attempts: i + 1 };
      }
      await wait(hint !== undefined ? Math.max(1, hint) * 1000 : BACKOFF_MS[i]);
      continue;
    }

    // network_error, timeout, server_error
    if (isLastTry) return { outcome, attempts: i + 1 };
    await wait(BACKOFF_MS[i]);
  }
  // Unreachable (the loop always returns within maxRetries + 1 iterations), but keeps TS happy.
  return { outcome: outcome!, attempts: maxRetries + 1 };
}
