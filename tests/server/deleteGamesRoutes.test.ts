import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer } from "./testServer.ts";

process.env.NODE_ENV = "test";
const { server } = await import("../../src/server/index.ts");

test("the delete-games HTTP routes", async (t) => {
  await withServer(server, async (base) => {
    await t.test("POST /api/games/delete: an invalid request is a 400 with the exact message", async () => {
      const res = await fetch(`${base}/api/games/delete`, { method: "POST", body: JSON.stringify({ ids: [] }) });
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { error: '"ids" must be a non-empty array of up to 10000 game ids' });
    });

    await t.test("POST /api/games/delete: removes stored games and reports how many", async () => {
      const pgn = '[White "alice"]\n[Black "bob"]\n[Result "1-0"]\n\n1. e4 e5 1-0';
      const importRes = await fetch(`${base}/api/games/import`, { method: "POST", body: pgn });
      const { gameIds } = (await importRes.json()) as { gameIds: string[] };

      const res = await fetch(`${base}/api/games/delete`, { method: "POST", body: JSON.stringify({ ids: [...gameIds, "ghost"] }) });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { deleted: 1 });

      const games = await (await fetch(`${base}/api/games`)).json();
      assert.deepEqual(games, []);
    });

    await t.test("POST /api/games/delete-all: empties the library but keeps settings", async () => {
      await fetch(`${base}/api/settings`, { method: "POST", body: JSON.stringify({ usernames: ["bc_tester"] }) });
      const pgn = '[White "carol"]\n[Black "dave"]\n[Result "1-0"]\n\n1. e4 e5 1-0';
      await fetch(`${base}/api/games/import`, { method: "POST", body: pgn });

      const res = await fetch(`${base}/api/games/delete-all`, { method: "POST" });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { ok: true });

      const games = await (await fetch(`${base}/api/games`)).json();
      assert.deepEqual(games, []);
      const settings = (await (await fetch(`${base}/api/settings`)).json()) as { usernames: string[] };
      assert.deepEqual(settings.usernames, ["bc_tester"]); // kept
    });
  });
});
