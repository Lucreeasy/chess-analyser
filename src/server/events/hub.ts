import type { WorkerEvent } from "../analysisQueue/worker.ts";
import type { ExploreEvent } from "../explore/session.ts";
import { Throttle } from "./throttle.ts";
import { APP_VERSION } from "../version.ts";

/** Live events pushed to every connected interface. */
export type LiveEvent =
  | WorkerEvent
  | ExploreEvent
  | { type: "gamesChanged" }
  | { type: "importProgress"; username: string; month: string; done: number; total: number };

export interface SseClient {
  write(chunk: string): void;
  onClose(cb: () => void): void;
}

/** Rate limits; event types absent here are sent unthrottled. */
const THROTTLE_MS: Partial<Record<LiveEvent["type"], number>> = {
  queue: 250,
  progress: 100,
  gamesChanged: 500,
};

function format(eventName: string, data: unknown): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Holds connected clients and broadcasts events to all of them, each event
 * type smoothed independently. A newly connected client gets
 * a `greeting` event with the app version; it must fetch current state
 * itself (for example the queue status) rather than being sent a snapshot.
 */
export class EventHub {
  readonly #clients = new Set<SseClient>();
  readonly #throttles = new Map<string, Throttle<LiveEvent>>();

  addClient(client: SseClient): void {
    this.#clients.add(client);
    client.write(format("greeting", { version: APP_VERSION }));
    client.onClose(() => this.#clients.delete(client));
  }

  broadcast(event: LiveEvent): void {
    const windowMs = THROTTLE_MS[event.type];
    if (windowMs === undefined) {
      this.#send(event);
      return;
    }
    let throttle = this.#throttles.get(event.type);
    if (!throttle) {
      throttle = new Throttle<LiveEvent>(windowMs, (e) => this.#send(e));
      this.#throttles.set(event.type, throttle);
    }
    throttle.push(event);
  }

  #send(event: LiveEvent): void {
    const chunk = format(event.type, event);
    for (const client of this.#clients) client.write(chunk);
  }
}
