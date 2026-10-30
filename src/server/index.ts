import { createServer } from "node:http";
import { openDb, insertGame, listGames } from "./db.ts";
import { parseGame } from "./import.ts";
import { serveStatic } from "./static.ts";
import { runAnalysis } from "./runAnalysis.ts";
import { getEngine, shutdownEngine } from "./engineClient.ts";

const DEPTHS = { quick: 12, standard: 16, deep: 20 } as const;

const port = Number(process.env.PORT) || 3000;
const dbPath =
  process.env.NODE_ENV === "test" ? ":memory:" : `${process.env.DATA_DIR || "data"}/games.db`;
const staticRoot = process.env.STATIC_DIR || "dist/web";

export const db = openDb(dbPath);

async function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export const server = createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.url === "/api/games" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(listGames(db)));
    return;
  }

  if (req.url === "/api/games/import" && req.method === "POST") {
    const pgn = await readBody(req);
    const game = parseGame(pgn, Date.now());
    insertGame(db, game);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ added: [game.id] }));
    return;
  }

  if (req.url === "/api/analyse" && req.method === "POST") {
    const body = JSON.parse(await readBody(req)) as { pgn: string; depth?: keyof typeof DEPTHS };
    try {
      const engine = await getEngine();
      const result = await runAnalysis(db, engine, body.pgn, {
        depth: DEPTHS[body.depth ?? "standard"],
        engineName: "Stockfish",
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
    return;
  }

  if (req.url?.startsWith("/api/")) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  await serveStatic(staticRoot, req, res);
});

if (process.env.NODE_ENV !== "test") {
  server.listen(port, () => {
    console.log(`listening on http://localhost:${port}`);
  });

  // Node does not apply the default "terminate" signal disposition when it
  // is PID 1 (as it is inside a container), so without a handler SIGTERM is
  // silently ignored and the container never stops cleanly (DOC-5).
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      server.close(() => {
        shutdownEngine().finally(() => {
          db.close();
          process.exit(0);
        });
      });
    });
  }
}
