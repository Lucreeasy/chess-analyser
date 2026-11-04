import { createServer } from "node:http";
import {
  openDb,
  insertGames,
  listGames,
  updateGames,
  getSettings,
  putSettings,
  getStoredEtag,
  putStoredEtag,
  deleteStoredEtag,
  clearRunningFlags,
  deleteGames,
  deleteAllData,
} from "./db.ts";
import { splitIntoGames } from "./import/pgnText.ts";
import { importGames } from "./import/report.ts";
import { serveStatic } from "./static.ts";
import { runAnalysis } from "./runAnalysis.ts";
import { getEngine, shutdownEngine } from "./engineClient.ts";
import { fetchArchiveMonths, type FetchLike } from "./chesscom/client.ts";
import { chessComPacer } from "./chesscom/sharedPacer.ts";
import { isValidUsername } from "./chesscom/parsing.ts";
import { validateImportRequest } from "./chesscom/requestValidation.ts";
import { monthsInRange, autoSyncMonths } from "./chesscom/monthRange.ts";
import { syncMonths, type SyncResult } from "./chesscom/sync.ts";
import { AutoSyncScheduler, parseIntervalHours } from "./chesscom/autoSyncScheduler.ts";
import { validateSettingsUpdate } from "./settings.ts";
import { rederiveMe } from "./rederiveMe.ts";
import { ALL_TIME_CLASSES } from "./import/timeClass.ts";
import type { DepthPreset } from "./settings.ts";
import { SEARCH_DEPTH, oneStepDeeper } from "./analysisQueue/depthPresets.ts";
import { toGameListRow } from "./games/listRows.ts";
import { AnalysisWorker } from "./analysisQueue/worker.ts";
import { validateQueueRequest, unknownIdsMessage, validateDeleteRequest } from "./analysisQueue/requestValidation.ts";
import { enqueueGames, unknownGameIds, autoQueueNewGames } from "./analysisQueue/queue.ts";
import type { StoredGame } from "./import/parseGame.ts";

// A mutable binding so tests can point chess.com calls at a fake transport instead of the real network.
export const chessComDeps: { fetch: FetchLike } = { fetch: fetch as FetchLike };

const port = Number(process.env.PORT) || 3000;
const dbPath =
  process.env.NODE_ENV === "test" ? ":memory:" : `${process.env.DATA_DIR || "data"}/games.db`;
const staticRoot = process.env.STATIC_DIR || "dist/web";

export const db = openDb(dbPath);

const ALL_TIME_CLASSES_SET = new Set(ALL_TIME_CLASSES);

function storeAndAutoQueue(games: StoredGame[]): number {
  insertGames(db, games);
  const queued = autoQueueNewGames(db, games.map((g) => g.id), Date.now());
  if (queued > 0) analysisWorker.notify();
  return queued;
}

async function runUsernameSync(username: string): Promise<SyncResult> {
  const months = autoSyncMonths(new Date());
  const alreadyStored = new Set(listGames(db).map((g) => g.id));
  return syncMonths(chessComDeps.fetch, chessComPacer, username, months, ALL_TIME_CLASSES_SET, alreadyStored, storeAndAutoQueue, Date.now(), {
    etags: {
      get: (month) => getStoredEtag(db, username, month),
      store: (month, etag) => putStoredEtag(db, username, month, etag, Date.now()),
      clear: (month) => deleteStoredEtag(db, username, month),
    },
  });
}

export const autoSync = new AutoSyncScheduler(parseIntervalHours(process.env.AUTO_SYNC_INTERVAL_HOURS), () => getSettings(db).usernames, runUsernameSync);
if (process.env.NODE_ENV !== "test") autoSync.start();

// Start-up recovery (section 5.7): any entry left "running" by an interrupted process goes back to waiting.
clearRunningFlags(db);
export const analysisWorker = new AnalysisWorker(db, getEngine);
if (process.env.NODE_ENV !== "test") analysisWorker.notify(); // resume any work waiting from a previous run

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
    res.end(JSON.stringify(listGames(db).map((game) => toGameListRow(db, game))));
    return;
  }

  if (req.url === "/api/games/import" && req.method === "POST") {
    const text = await readBody(req);
    const gameTexts = splitIntoGames(text);
    const alreadyStored = new Set(listGames(db).map((g) => g.id));
    const { summary, newGames } = importGames(gameTexts, "paste", getSettings(db).usernames, Date.now(), alreadyStored);
    const queued = storeAndAutoQueue(newGames);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ...summary, queued }));
    return;
  }

  if (req.url === "/api/settings" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(getSettings(db)));
    return;
  }

  if (req.url === "/api/settings" && req.method === "POST") {
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(await readBody(req));
    } catch {
      parsedBody = undefined;
    }
    const current = getSettings(db);
    const validated = validateSettingsUpdate(parsedBody, current);
    if (!validated.ok) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: validated.message }));
      return;
    }
    const { settings } = validated;
    if (JSON.stringify(settings.usernames) !== JSON.stringify(current.usernames)) {
      updateGames(db, rederiveMe(listGames(db), settings.usernames));
    }
    putSettings(db, settings);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(settings));
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
    let queued = 0;
    const result = await syncMonths(
      chessComDeps.fetch,
      chessComPacer,
      username,
      months,
      timeClasses,
      alreadyStored,
      (games) => {
        queued += storeAndAutoQueue(games);
      },
      Date.now(),
    );

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ...result, queued }));
    return;
  }

  if (req.url === "/api/autosync/status" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(autoSync.status()));
    return;
  }

  if (req.url === "/api/autosync/sync-now" && req.method === "POST") {
    const result = autoSync.triggerNow();
    if (!result.ok) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: result.message }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(result.status));
    return;
  }

  if (req.url === "/api/analyse" && req.method === "POST") {
    const body = JSON.parse(await readBody(req)) as { pgn: string; depth?: DepthPreset };
    try {
      const engine = await getEngine();
      const result = await runAnalysis(db, engine, body.pgn, {
        depth: SEARCH_DEPTH[body.depth ?? "standard"],
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

  if (req.url === "/api/analyse/status" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(analysisWorker.status()));
    return;
  }

  if (req.url === "/api/analyse/pause" && req.method === "POST") {
    analysisWorker.pause();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(analysisWorker.status()));
    return;
  }

  if (req.url === "/api/analyse/resume" && req.method === "POST") {
    analysisWorker.resume();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(analysisWorker.status()));
    return;
  }

  if (req.url === "/api/analyse/queue" && req.method === "POST") {
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(await readBody(req));
    } catch {
      parsedBody = undefined;
    }
    const validated = validateQueueRequest(parsedBody);
    if (!validated.ok) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: validated.message }));
      return;
    }
    const { gameIds, depth, force, urgent, deeper } = validated.request;
    const unknown = unknownGameIds(db, gameIds);
    if (unknown.length > 0) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: unknownIdsMessage(unknown) }));
      return;
    }
    const defaultDepth = getSettings(db).depthPreset;
    enqueueGames(db, gameIds, deeper ? oneStepDeeper(defaultDepth) : depth ?? defaultDepth, force, urgent, Date.now());
    analysisWorker.notify();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(analysisWorker.status()));
    return;
  }

  if (req.url === "/api/games/delete" && req.method === "POST") {
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(await readBody(req));
    } catch {
      parsedBody = undefined;
    }
    const validated = validateDeleteRequest(parsedBody);
    if (!validated.ok) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: validated.message }));
      return;
    }
    for (const id of validated.ids) analysisWorker.abortGame(id);
    const deleted = deleteGames(db, validated.ids);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ deleted }));
    return;
  }

  if (req.url === "/api/games/delete-all" && req.method === "POST") {
    const running = analysisWorker.status().running;
    if (running) analysisWorker.abortGame(running.gameId);
    deleteAllData(db);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
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
      autoSync.stop();
      analysisWorker.stop().finally(() => {
        server.close(() => {
          shutdownEngine().finally(() => {
            db.close();
            process.exit(0);
          });
        });
      });
    });
  }
}
