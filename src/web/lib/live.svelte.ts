/**
 * The live event channel (SSE). A
 * single connection for the whole app, opened once this module is
 * imported (same module-singleton pattern as router.svelte.ts). SSE
 * never replays history to a new connection, so on the greeting this
 * fetches the current queue status itself, as the spec requires.
 */

import { SvelteMap } from "svelte/reactivity";
import { apiGet } from "./api.ts";
import type { ExploreLine } from "../../server/explore/session.ts";

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

export interface AnalyseProgress {
  gameId: string;
  ply: number;
  total: number;
}

export interface ExploreProgress {
  clientId: string;
  requestId: string;
  lines: ExploreLine[];
  reachedDepth: number;
}
export interface ExploreError {
  clientId: string;
  requestId: string;
  message: string;
}

export const queue: { status: QueueStatus | undefined } = $state({ status: undefined });

// "socket/engine channel down" is this live channel itself, not the engine.
export const live: { connected: boolean } = $state({ connected: false });

// Live Win% per ply while a game is being analysed, kept
// across visits to the Review screen and discarded (by key prefix) once the game finishes.
const liveEvalsByGame = new SvelteMap<string, number>();

function liveEvalKey(gameId: string, ply: number): string {
  return `${gameId}:${ply}`;
}

export function liveEvalAt(gameId: string, ply: number): number | undefined {
  return liveEvalsByGame.get(liveEvalKey(gameId, ply));
}

function clearLiveEvals(gameId: string): void {
  for (const key of liveEvalsByGame.keys()) {
    if (key.startsWith(`${gameId}:`)) liveEvalsByGame.delete(key);
  }
}

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
const analyseProgress = listenerSet<AnalyseProgress>();
const gameAnalysed = listenerSet<string>();
const exploreProgress = listenerSet<ExploreProgress>();
const exploreDone = listenerSet<ExploreProgress>();
const exploreError = listenerSet<ExploreError>();
const exploreBusy = listenerSet<string>();

export const onGamesChanged = gamesChanged.on;
export const onImportProgress = importProgress.on;
export const onAnalyseProgress = analyseProgress.on;
export const onGameAnalysed = gameAnalysed.on;
export const onExploreProgress = exploreProgress.on;
export const onExploreDone = exploreDone.on;
export const onExploreError = exploreError.on;
export const onExploreBusy = exploreBusy.on;

const source = new EventSource("api/events");

source.addEventListener("open", () => {
  live.connected = true;
});
source.addEventListener("error", () => {
  live.connected = false;
});

source.addEventListener("greeting", () => {
  live.connected = true;
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

source.addEventListener("progress", (e) => {
  const data = JSON.parse((e as MessageEvent).data) as AnalyseProgress;
  for (const listener of analyseProgress.listeners) listener(data);
});

source.addEventListener("plyEval", (e) => {
  const data = JSON.parse((e as MessageEvent).data) as { gameId: string; ply: number; win: number };
  liveEvalsByGame.set(liveEvalKey(data.gameId, data.ply), data.win);
});

source.addEventListener("gameAnalysed", (e) => {
  const data = JSON.parse((e as MessageEvent).data) as { gameId: string };
  clearLiveEvals(data.gameId);
  for (const listener of gameAnalysed.listeners) listener(data.gameId);
});

source.addEventListener("exploreProgress", (e) => {
  const data = JSON.parse((e as MessageEvent).data) as ExploreProgress;
  for (const listener of exploreProgress.listeners) listener(data);
});

source.addEventListener("exploreDone", (e) => {
  const data = JSON.parse((e as MessageEvent).data) as ExploreProgress;
  for (const listener of exploreDone.listeners) listener(data);
});

source.addEventListener("exploreError", (e) => {
  const data = JSON.parse((e as MessageEvent).data) as ExploreError;
  for (const listener of exploreError.listeners) listener(data);
});

source.addEventListener("exploreBusy", (e) => {
  const data = JSON.parse((e as MessageEvent).data) as { clientId: string };
  for (const listener of exploreBusy.listeners) listener(data.clientId);
});
