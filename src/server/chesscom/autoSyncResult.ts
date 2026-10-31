import type { SyncResult } from "./sync.ts";

/** One username's result in auto-sync's status. docs/03-IMPORT-SPEC.md section 4.4. */
export interface UsernameSyncResult {
  username: string;
  added: number;
  duplicates: number;
  failed: number;
  error?: string;
}

/**
 * Builds the status entry for one username from its sync result: `error`
 * joins every month that ended in "error" or "rate_limited" as
 * "{month}: {message}"; a month that was simply not found is not a
 * problem.
 */
export function summarizeUsernameSync(username: string, result: SyncResult): UsernameSyncResult {
  const problems = result.months.filter((month) => month.status === "error" || month.status === "rate_limited");
  const entry: UsernameSyncResult = { username, added: result.added, duplicates: result.duplicates, failed: result.failed };
  if (problems.length > 0) entry.error = problems.map((month) => `${month.month}: ${month.message}`).join("; ");
  return entry;
}
