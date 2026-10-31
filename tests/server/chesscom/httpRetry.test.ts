import { test } from "node:test";
import assert from "node:assert/strict";
import { withRetry, type AttemptOutcome } from "../../../src/server/chesscom/httpRetry.ts";

function recordingWait(): { wait: (ms: number) => Promise<void>; waits: number[] } {
  const waits: number[] = [];
  return { wait: async (ms) => void waits.push(ms), waits };
}

function scripted<T extends AttemptOutcome>(outcomes: T[]): () => Promise<T> {
  let i = 0;
  return async () => outcomes[Math.min(i++, outcomes.length - 1)];
}

// docs/03-IMPORT-SPEC.md section 8, acceptance scenario 10.
test("429 with Retry-After: 7 waits 7s, then retries and succeeds", async () => {
  const { wait, waits } = recordingWait();
  const attempt = scripted<AttemptOutcome>([{ kind: "rate_limited", retryAfterSeconds: 7 }, { kind: "ok" }]);
  const { outcome, attempts } = await withRetry(attempt, 3, wait);
  assert.equal(outcome.kind, "ok");
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [7000]);
});

test("429 without a header backs off 2s/4s/8s, then reports rate_limited with hint 16", async () => {
  const { wait, waits } = recordingWait();
  const attempt = scripted<AttemptOutcome>([{ kind: "rate_limited" }]);
  const { outcome, attempts } = await withRetry(attempt, 3, wait);
  assert.equal(outcome.kind, "rate_limited");
  assert.equal(outcome.retryAfterSeconds, 16);
  assert.equal(attempts, 4);
  assert.deepEqual(waits, [2000, 4000, 8000]);
});

test("Retry-After: 3600 (over 120s) fails immediately, no wait, one attempt", async () => {
  const { wait, waits } = recordingWait();
  const attempt = scripted<AttemptOutcome>([{ kind: "rate_limited", retryAfterSeconds: 3600 }]);
  const { outcome, attempts } = await withRetry(attempt, 3, wait);
  assert.equal(outcome.kind, "rate_limited");
  assert.equal(outcome.retryAfterSeconds, 3600);
  assert.equal(attempts, 1);
  assert.deepEqual(waits, []);
});

// docs/03-IMPORT-SPEC.md section 8, acceptance scenario 9.
test("404/410 is not retried", async () => {
  const { wait, waits } = recordingWait();
  const attempt = scripted<AttemptOutcome>([{ kind: "not_found" }, { kind: "ok" }]);
  const { outcome, attempts } = await withRetry(attempt, 3, wait);
  assert.equal(outcome.kind, "not_found");
  assert.equal(attempts, 1);
  assert.deepEqual(waits, []);
});

test("network errors retry with the same 2s/4s/8s backoff, final outcome reported after exhausting retries", async () => {
  const { wait, waits } = recordingWait();
  const attempt = scripted<AttemptOutcome>([{ kind: "network_error" }]);
  const { outcome, attempts } = await withRetry(attempt, 3, wait);
  assert.equal(outcome.kind, "network_error");
  assert.equal(attempts, 4);
  assert.deepEqual(waits, [2000, 4000, 8000]);
});

test("5xx is retried, then succeeds on a later attempt", async () => {
  const { wait } = recordingWait();
  const attempt = scripted<AttemptOutcome>([{ kind: "server_error" }, { kind: "server_error" }, { kind: "ok" }]);
  const { outcome, attempts } = await withRetry(attempt, 3, wait);
  assert.equal(outcome.kind, "ok");
  assert.equal(attempts, 3);
});

test("any other status (e.g. 403) is not retried", async () => {
  const { waits } = recordingWait();
  const attempt = scripted<AttemptOutcome>([{ kind: "other_status" }]);
  const { outcome, attempts } = await withRetry(attempt, 3, async (ms) => void waits.push(ms));
  assert.equal(outcome.kind, "other_status");
  assert.equal(attempts, 1);
});

test("a timeout is retried like a network error", async () => {
  const { wait, waits } = recordingWait();
  const attempt = scripted<AttemptOutcome>([{ kind: "timeout" }, { kind: "ok" }]);
  const { outcome } = await withRetry(attempt, 3, wait);
  assert.equal(outcome.kind, "ok");
  assert.deepEqual(waits, [2000]);
});
