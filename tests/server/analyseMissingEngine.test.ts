import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer } from "./testServer.ts";

process.env.NODE_ENV = "test";
process.env.ENGINE_PATH = "/no/such/engine-binary";
const { server } = await import("../../src/server/index.ts");

// Without the engine, games stay un-analysed with a clear message and nothing else breaks.
test("a missing engine leaves the game un-analysed with a clear message, and the rest of the app still works", async () => {
  await withServer(server, async (base) => {
    const pgn = '[White "a"]\n[Black "b"]\n[Result "1-0"]\n\n1. e4 e5 1-0';
    const { gameIds } = (await (await fetch(`${base}/api/games/import`, { method: "POST", body: pgn })).json()) as { gameIds: string[] };
    let game: { analysisStatus: string; errorMessage?: string } | undefined;
    for (let i = 0; i < 50 && game?.analysisStatus !== "error"; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      game = await (await fetch(`${base}/api/games/${encodeURIComponent(gameIds[0]!)}`)).json();
    }
    assert.equal(game?.analysisStatus, "error");
    assert.match(game?.errorMessage ?? "", /engine unavailable/);

    assert.equal((await fetch(`${base}/health`)).status, 200);
    assert.equal((await fetch(`${base}/api/games`)).status, 200);
  });
});
