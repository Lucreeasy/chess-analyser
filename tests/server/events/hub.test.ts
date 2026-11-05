import { test } from "node:test";
import assert from "node:assert/strict";
import { EventHub, type SseClient } from "../../../src/server/events/hub.ts";

function fakeClient(): SseClient & { chunks: string[]; close: () => void } {
  const chunks: string[] = [];
  let closeCb: (() => void) | undefined;
  return {
    chunks,
    write: (chunk: string) => chunks.push(chunk),
    onClose: (cb: () => void) => (closeCb = cb),
    close: () => closeCb?.(),
  };
}

test("addClient: sends a greeting event with the app version", () => {
  const hub = new EventHub();
  const client = fakeClient();
  hub.addClient(client);

  assert.equal(client.chunks.length, 1);
  assert.match(client.chunks[0]!, /^event: greeting\ndata: \{"version":"[^"]+"\}\n\n$/);
});

test("broadcast: an unthrottled event type (gameAnalysed) reaches every connected client immediately", () => {
  const hub = new EventHub();
  const a = fakeClient();
  const b = fakeClient();
  hub.addClient(a);
  hub.addClient(b);

  hub.broadcast({ type: "gameAnalysed", gameId: "g1" });

  for (const client of [a, b]) {
    assert.equal(client.chunks.length, 2); // greeting + the event
    assert.equal(client.chunks[1], 'event: gameAnalysed\ndata: {"type":"gameAnalysed","gameId":"g1"}\n\n');
  }
});

test("broadcast: a throttled event type (queue) still sends its leading push immediately", () => {
  const hub = new EventHub();
  const client = fakeClient();
  hub.addClient(client);

  const status = { paused: false, pending: 1, done: 0, total: 1, running: null };
  hub.broadcast({ type: "queue", status });

  assert.equal(client.chunks.length, 2);
  assert.equal(client.chunks[1], `event: queue\ndata: ${JSON.stringify({ type: "queue", status })}\n\n`);
});

test("a closed client is dropped and receives no further events", () => {
  const hub = new EventHub();
  const client = fakeClient();
  hub.addClient(client);
  client.close();

  hub.broadcast({ type: "gameAnalysed", gameId: "g1" });

  assert.equal(client.chunks.length, 1); // only the greeting from before closing
});

test("each event type is throttled independently of the others", () => {
  const hub = new EventHub();
  const client = fakeClient();
  hub.addClient(client);

  hub.broadcast({ type: "queue", status: { paused: false, pending: 1, done: 0, total: 1, running: null } });
  hub.broadcast({ type: "progress", gameId: "g1", ply: 1, total: 10 });

  // Both leading pushes go through even though they're different throttled streams.
  assert.equal(client.chunks.length, 3);
});
