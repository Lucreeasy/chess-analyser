/**
 * The live event channel (SSE). docs/03-IMPORT-SPEC.md section 5.6. A
 * single connection for the whole app, opened once this module is
 * imported (same module-singleton pattern as router.svelte.ts). SSE
 * never replays history to a new connection, so on the greeting this
 * fetches the current queue status itself, as the spec requires.
 */

import { apiGet } from "./api.ts";

export interface QueueStatus {
  paused: boolean;
  pending: number;
  done: number;
  total: number;
  running: { gameId: string; ply: number; totalPlies: number } | null;
}

export interface ImportProgress {
  username: string;
  month: string;
  done: number;
  total: number;
}

export const queue: { status: QueueStatus | undefined } = $state({ status: undefined });

type Listener<T> = (value: T) => void;

function listenerSet<T>(): { listeners: Set<Listener<T>>; on: (listener: Listener<T>) => () => void } {
  const listeners = new Set<Listener<T>>();
  return {
    listeners,
    on: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const gamesChanged = listenerSet<void>();
const importProgress = listenerSet<ImportProgress>();

export const onGamesChanged = gamesChanged.on;
export const onImportProgress = importProgress.on;

const source = new EventSource("api/events");

source.addEventListener("greeting", () => {
  apiGet<QueueStatus>("analyse/status")
    .then((status) => (queue.status = status))
    .catch(() => {});
});

source.addEventListener("queue", (e) => {
  queue.status = (JSON.parse((e as MessageEvent).data) as { status: QueueStatus }).status;
});

source.addEventListener("gamesChanged", () => {
  for (const listener of gamesChanged.listeners) listener();
});

source.addEventListener("importProgress", (e) => {
  const data = JSON.parse((e as MessageEvent).data) as ImportProgress;
  for (const listener of importProgress.listeners) listener(data);
});
