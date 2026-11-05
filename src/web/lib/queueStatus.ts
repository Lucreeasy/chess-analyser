import type { QueueStatus } from "./live.svelte.ts";

/** Text and numbers for the analysis queue strip. docs/07-UI-SPEC.md section 2.4. */

export function queueVisible(status: QueueStatus | undefined): boolean {
  return status !== undefined && (status.pending > 0 || status.running !== null);
}

export function currentCount(status: QueueStatus): number {
  return Math.min(status.total, status.done + (status.running ? 1 : 0));
}

export function queueLabel(status: QueueStatus): string {
  const current = currentCount(status);
  return status.paused ? `Paused at ${current} of ${status.total}` : `Analysing ${current} of ${status.total}…`;
}

/** The running game's progress in percent (0 while nothing is running or it has no plies yet). */
export function progressPercent(status: QueueStatus): number {
  if (status.running === null || status.running.totalPlies === 0) return 0;
  return Math.round((status.running.ply / status.running.totalPlies) * 100);
}
