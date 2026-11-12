import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer } from "./testServer.ts";

process.env.NODE_ENV = "test";
const { server } = await import("../../src/server/index.ts");

test("GET /api/settings answers the defaults before anything is stored", async () => {
  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/settings`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { usernames: [], depthPreset: "standard", autoAnalyse: true, autoSyncHours: 6 });
  });
});

test("POST /api/settings: an invalid update is a 400 with the exact message, nothing is stored", async () => {
  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/settings`, { method: "POST", body: JSON.stringify({ usernames: ["a"] }) });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: '"a" is not a chess.com username (3-25 letters, digits, "_" or "-")' });

    const after = await (await fetch(`${base}/api/settings`)).json();
    assert.deepEqual(after, { usernames: [], depthPreset: "standard", autoAnalyse: true, autoSyncHours: 6 });
  });
});

test("POST /api/settings: a valid update is stored and returned", async () => {
  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/settings`, { method: "POST", body: JSON.stringify({ usernames: ["BC_Tester"] }) });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { usernames: ["bc_tester"], depthPreset: "standard", autoAnalyse: true, autoSyncHours: 6 });

    const after = await (await fetch(`${base}/api/settings`)).json();
    assert.deepEqual(after, { usernames: ["bc_tester"], depthPreset: "standard", autoAnalyse: true, autoSyncHours: 6 });
  });
});

test("changing the username list re-derives colour and personal result for stored games", async () => {
  await withServer(server, async (base) => {
    const pgn = '[White "alice"]\n[Black "bob"]\n[Result "1-0"]\n\n1. e4 e5 1-0';
    await fetch(`${base}/api/games/import`, { method: "POST", body: pgn });

    const before = (await (await fetch(`${base}/api/games`)).json()) as Array<{ myColour?: string }>;
    assert.equal(before[0]!.myColour, undefined); // no username saved yet

    await fetch(`${base}/api/settings`, { method: "POST", body: JSON.stringify({ usernames: ["bob"] }) });

    const after = (await (await fetch(`${base}/api/games`)).json()) as Array<{ myColour?: string; myResult?: string }>;
    assert.equal(after[0]!.myColour, "b");
    assert.equal(after[0]!.myResult, "loss");
  });
});

test("pasted imports use the saved usernames to resolve colour and personal result", async () => {
  await withServer(server, async (base) => {
    await fetch(`${base}/api/settings`, { method: "POST", body: JSON.stringify({ usernames: ["alice"] }) });

    const pgn = '[White "alice"]\n[Black "carol"]\n[Result "1-0"]\n\n1. e4 e5 1-0';
    await fetch(`${base}/api/games/import`, { method: "POST", body: pgn });

    const games = (await (await fetch(`${base}/api/games`)).json()) as Array<{ myColour?: string; myResult?: string }>;
    assert.equal(games[0]!.myColour, "w");
    assert.equal(games[0]!.myResult, "win");
  });
});

test("the saved auto-sync interval is the scheduler's interval", async () => {
  await withServer(server, async (base) => {
    await fetch(`${base}/api/settings`, { method: "POST", body: JSON.stringify({ autoSyncHours: 12 }) });
    assert.equal((await (await fetch(`${base}/api/autosync/status`)).json()).intervalHours, 12);
    await fetch(`${base}/api/settings`, { method: "POST", body: JSON.stringify({ autoSyncHours: 0 }) });
    const off = await (await fetch(`${base}/api/autosync/status`)).json();
    assert.deepEqual([off.intervalHours, off.enabled], [0, false]);
  });
});
