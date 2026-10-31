import { createServer } from "node:http";
import { openDb, insertGames, listGames } from "./db.ts";
import { splitIntoGames } from "./import/pgnText.ts";
import { importGames } from "./import/report.ts";
import { serveStatic } from "./static.ts";
import { runAnalysis } from "./runAnalysis.ts";
import { getEngine, shutdownEngine } from "./engineClient.ts";
import { fetchArchiveMonths, type FetchLike } from "./chesscom/client.ts";
import { chessComPacer } from "./chesscom/sharedPacer.ts";
import { isValidUsername } from "./chesscom/parsing.ts";
import { validateImportRequest } from "./chesscom/requestValidation.ts";
import { monthsInRange } from "./chesscom/monthRange.ts";
import { syncMonths } from "./chesscom/sync.ts";

const DEPTHS = { quick: 12, standard: 16, deep: 20 } as const;

// A mutable binding so tests can point chess.com calls at a fake transport instead of the real network.
export const chessComDeps: { fetch: FetchLike } = { fetch: fetch as FetchLike };

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

/** Section 3.2: the archive-list/import-level chess.com failures (not_found, rate_limited, error). */
function chessComFailureResponse(result: {
  status: "ok" | "not_found" | "rate_limited" | "error";
  message?: string;
  retryAfterSeconds?: number;
}): {
  httpStatus: number;
  headers: Record<string, string>;
  body: { error: string | undefined; retryAfterSeconds?: number };
} {
  if (result.status === "not_found") return { httpStatus: 404, headers: {} as Record<string, string>, body: { error: result.message } };
  if (result.status === "rate_limited") {
    const headers: Record<string, string> =
      result.retryAfterSeconds === undefined ? {} : { "retry-after": String(result.retryAfterSeconds) };
    return { httpStatus: 429, headers, body: { error: result.message, retryAfterSeconds: result.retryAfterSeconds } };
  }
  return { httpStatus: 502, headers: {} as Record<string, string>, body: { error: result.message } };
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
    const text = await readBody(req);
    const gameTexts = splitIntoGames(text);
    // TODO once Settings (section 6) exists: read the saved usernames instead of an empty list.
    const alreadyStored = new Set(listGames(db).map((g) => g.id));
    const { summary, newGames } = importGames(gameTexts, "paste", [], Date.now(), alreadyStored);
    insertGames(db, newGames);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ...summary, queued: 0 }));
    return;
  }

  if (req.url?.startsWith("/api/chesscom/archives") && req.method === "GET") {
    const username = new URL(req.url, "http://localhost").searchParams.get("username") ?? "";
    if (!isValidUsername(username)) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: 'username must be 3-25 letters, digits, "_" or "-"' }));
      return;
    }
    const result = await fetchArchiveMonths(chessComDeps.fetch, chessComPacer, username);
    if (result.status === "ok") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ months: result.months }));
      return;
    }
    const { httpStatus, headers, body } = chessComFailureResponse(result);
    res.writeHead(httpStatus, { "content-type": "application/json", ...headers });
    res.end(JSON.stringify(body));
    return;
  }

  if (req.url === "/api/chesscom/import" && req.method === "POST") {
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(await readBody(req));
    } catch {
      parsedBody = undefined;
    }
    const validated = validateImportRequest(parsedBody);
    if (!validated.ok) {
      res.writeHead(validated.status, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: validated.message }));
      return;
    }
    const { username, from, to, timeClasses } = validated.request;

    const archives = await fetchArchiveMonths(chessComDeps.fetch, chessComPacer, username);
    if (archives.status !== "ok") {
      const { httpStatus, headers, body } = chessComFailureResponse(archives);
      res.writeHead(httpStatus, { "content-type": "application/json", ...headers });
      res.end(JSON.stringify(body));
      return;
    }

    const months = monthsInRange(archives.months ?? [], from, to);
    const alreadyStored = new Set(listGames(db).map((g) => g.id));
    const result = await syncMonths(
      chessComDeps.fetch,
      chessComPacer,
      username,
      months,
      timeClasses,
      alreadyStored,
      (games) => insertGames(db, games),
      Date.now(),
    );

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ...result, queued: 0 }));
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
