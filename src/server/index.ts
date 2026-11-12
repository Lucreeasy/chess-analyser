import { computeInsights } from "./insights/insights.ts";
import { parseInsightsQuery } from "./insights/select.ts";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  openDb,
  insertGames,
  listGames,
  getGame,
  getAnalysis,
  updateGames,
  getSettings,
  putSettings,
  getStoredEtag,
  putStoredEtag,
  deleteStoredEtag,
  clearRunningFlags,
  deleteGames,
  deleteAllData,
  countAnalyses,
} from "./db.ts";
import { splitIntoGames } from "./import/pgnText.ts";
import { importGames } from "./import/report.ts";
import { serveStatic } from "./static.ts";
import { getEngine, shutdownEngine } from "./engineClient.ts";
import { fetchArchiveMonths, type FetchLike } from "./chesscom/client.ts";
import { chessComPacer } from "./chesscom/sharedPacer.ts";
import { isValidUsername } from "./chesscom/parsing.ts";
import { validateImportRequest } from "./chesscom/requestValidation.ts";
import { monthsInRange, autoSyncMonths } from "./chesscom/monthRange.ts";
import { syncMonths, type SyncResult } from "./chesscom/sync.ts";
import { AutoSyncScheduler } from "./chesscom/autoSyncScheduler.ts";
import { validateSettingsUpdate } from "./settings.ts";
import { syncAllPuzzles, listPuzzles, getPuzzle, saveSchedule } from "./puzzles/store.ts";
import { checkAnswer, puzzleEvaluator } from "./puzzles/check.ts";
import { listView, parseListQuery } from "./puzzles/list.ts";
import { rederiveMe } from "./rederiveMe.ts";
import { ALL_TIME_CLASSES } from "./import/timeClass.ts";
import { oneStepDeeper } from "./analysisQueue/depthPresets.ts";
import { toGameListRow } from "./games/listRows.ts";
import { opponentOf } from "./games/shared.ts";
import { toGameReviewRow } from "./games/reviewRow.ts";
import { AnalysisWorker } from "./analysisQueue/worker.ts";
import { validateQueueRequest, unknownIdsMessage, validateDeleteRequest } from "./analysisQueue/requestValidation.ts";
import { enqueueGames, unknownGameIds, autoQueueNewGames } from "./analysisQueue/queue.ts";
import type { StoredGame } from "./import/parseGame.ts";
import { EventHub } from "./events/hub.ts";
import type { WorkerEvent } from "./analysisQueue/worker.ts";
import { legalDestinations, applyMove } from "./explore/position.ts";
import { ExploreSession } from "./explore/session.ts";

// A mutable binding so tests can point chess.com calls at a fake transport instead of the real network.
export const chessComDeps: { fetch: FetchLike } = { fetch: fetch as FetchLike };

const port = Number(process.env.PORT) || 3000;
const dbPath =
  process.env.NODE_ENV === "test" ? ":memory:" : `${process.env.DATA_DIR || "data"}/games.db`;
const staticRoot = process.env.STATIC_DIR || "dist/web";

export const db = openDb(dbPath);
export const eventHub = new EventHub();

const ALL_TIME_CLASSES_SET = new Set(ALL_TIME_CLASSES);

function storeAndAutoQueue(games: StoredGame[]): number {
  insertGames(db, games);
  const queued = autoQueueNewGames(db, games.map((g) => g.id), Date.now());
  if (queued > 0) analysisWorker.notify();
  eventHub.broadcast({ type: "gamesChanged" });
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

export const autoSync = new AutoSyncScheduler(() => getSettings(db).autoSyncHours, () => getSettings(db).usernames, runUsernameSync);
if (process.env.NODE_ENV !== "test") autoSync.start();

function onWorkerEvent(event: WorkerEvent): void {
  eventHub.broadcast(event);
  if (event.type === "queue") eventHub.broadcast({ type: "gamesChanged" });
}

// Start-up recovery: any entry left "running" by an interrupted process goes back to waiting.
clearRunningFlags(db);
export const analysisWorker = new AnalysisWorker(db, getEngine, { onEvent: onWorkerEvent });
if (process.env.NODE_ENV !== "test") analysisWorker.notify(); // resume any work waiting from a previous run

export const exploreSession = new ExploreSession({ getEngine, onEvent: (event) => eventHub.broadcast(event) });

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** The request body as JSON, or undefined when it is not valid JSON (the validators then answer 400). */
async function readJson(req: IncomingMessage): Promise<unknown> {
  try {
    return JSON.parse(await readBody(req));
  } catch {
    return undefined;
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

/** The archive-list/import-level chess.com failures (not_found, rate_limited, error). */
function sendChessComFailure(
  res: ServerResponse,
  result: { status: "ok" | "not_found" | "rate_limited" | "error"; message?: string; retryAfterSeconds?: number },
): void {
  if (result.status === "not_found") return sendJson(res, 404, { error: result.message });
  if (result.status !== "rate_limited") return sendJson(res, 502, { error: result.message });
  const headers: Record<string, string> = result.retryAfterSeconds === undefined ? {} : { "retry-after": String(result.retryAfterSeconds) };
  sendJson(res, 429, { error: result.message, retryAfterSeconds: result.retryAfterSeconds }, headers);
}

const asObject = (body: unknown) => (typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {});
const searchParams = (url: string) => new URL(url, "http://localhost").searchParams;

export const server = createServer(async (req, res) => {
  const url = req.url ?? "";
  const get = req.method === "GET";
  const post = req.method === "POST";

  if (url === "/health") return sendJson(res, 200, { status: "ok" });

  if (url === "/api/events" && get) {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    eventHub.addClient({ write: (chunk) => res.write(chunk), onClose: (cb) => req.on("close", cb) });
    return;
  }

  if (url === "/api/games" && get) return sendJson(res, 200, listGames(db).map((game) => toGameListRow(db, game)));

  if (url.startsWith("/api/games/") && get) {
    const game = getGame(db, decodeURIComponent(url.slice("/api/games/".length)));
    return game ? sendJson(res, 200, toGameReviewRow(db, game)) : sendJson(res, 404, { error: "game not found" });
  }

  if (url.startsWith("/api/insights") && get) {
    const query = parseInsightsQuery(searchParams(url));
    const games = listGames(db).map((game) => ({ game, analysis: getAnalysis(db, game.id)?.analysis }));
    return sendJson(res, 200, computeInsights(games, query, Date.now()));
  }

  if (url.startsWith("/api/puzzles?") || url === "/api/puzzles") {
    const query = parseListQuery(searchParams(url));
    if (typeof query === "string") return sendJson(res, 400, { error: query });
    const opponents = new Map(listGames(db).map((g) => [g.id, opponentOf(g)]));
    const view = listView(listPuzzles(db), query, Date.now());
    const items = view.items.map((item) => ({ ...item, opponent: opponents.get(item.gameId) }));
    return sendJson(res, 200, { ...view, items, analysedGames: countAnalyses(db) });
  }

  const attemptMatch = post ? url.match(/^\/api\/puzzles\/([0-9a-f]{16})\/attempt$/) : null;
  if (attemptMatch) {
    const puzzle = getPuzzle(db, attemptMatch[1]);
    const body = await readJson(req);
    if (!puzzle) return sendJson(res, 404, { error: "no such puzzle" });
    const answer = await checkAnswer(puzzle, typeof body === "object" && body !== null ? body : {}, puzzleEvaluator(db, getEngine), Date.now());
    if ("error" in answer) return sendJson(res, 400, answer);
    saveSchedule(db, puzzle.id, answer.schedule);
    return sendJson(res, 200, answer.result);
  }

  if (url === "/api/puzzles/refresh" && post) return sendJson(res, 200, syncAllPuzzles(db, Date.now()));

  if (url === "/api/games/import" && post) {
    const gameTexts = splitIntoGames(await readBody(req));
    const alreadyStored = new Set(listGames(db).map((g) => g.id));
    const { summary, newGames } = importGames(gameTexts, "paste", getSettings(db).usernames, Date.now(), alreadyStored);
    const queued = storeAndAutoQueue(newGames);
    return sendJson(res, 200, { ...summary, queued });
  }

  if (url === "/api/settings" && get) return sendJson(res, 200, getSettings(db));

  if (url === "/api/settings" && post) {
    const current = getSettings(db);
    const validated = validateSettingsUpdate(await readJson(req), current);
    if (!validated.ok) return sendJson(res, 400, { error: validated.message });
    const { settings } = validated;
    if (JSON.stringify(settings.usernames) !== JSON.stringify(current.usernames)) {
      updateGames(db, rederiveMe(listGames(db), settings.usernames));
      syncAllPuzzles(db, Date.now()); // "which side is me" changed
      eventHub.broadcast({ type: "gamesChanged" });
    }
    putSettings(db, settings);
    if (settings.autoSyncHours !== current.autoSyncHours && process.env.NODE_ENV !== "test") {
      autoSync.stop(); // the new interval applies from now
      autoSync.start();
    }
    return sendJson(res, 200, settings);
  }

  if (url.startsWith("/api/chesscom/archives") && get) {
    const username = searchParams(url).get("username") ?? "";
    if (!isValidUsername(username)) return sendJson(res, 400, { error: 'username must be 3-25 letters, digits, "_" or "-"' });
    const result = await fetchArchiveMonths(chessComDeps.fetch, chessComPacer, username);
    return result.status === "ok" ? sendJson(res, 200, { months: result.months }) : sendChessComFailure(res, result);
  }

  if (url === "/api/chesscom/import" && post) {
    const validated = validateImportRequest(await readJson(req));
    if (!validated.ok) return sendJson(res, validated.status, { error: validated.message });
    const { username, from, to, timeClasses } = validated.request;
    const archives = await fetchArchiveMonths(chessComDeps.fetch, chessComPacer, username);
    if (archives.status !== "ok") return sendChessComFailure(res, archives);

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
      { onProgress: (e) => eventHub.broadcast({ type: "importProgress", ...e }) },
    );
    return sendJson(res, 200, { ...result, queued });
  }

  if (url === "/api/autosync/status" && get) return sendJson(res, 200, autoSync.status());

  if (url === "/api/autosync/sync-now" && post) {
    const result = autoSync.triggerNow();
    return result.ok ? sendJson(res, 200, result.status) : sendJson(res, 400, { error: result.message });
  }

  if (url === "/api/analyse/status" && get) return sendJson(res, 200, analysisWorker.status());

  if (url === "/api/analyse/pause" && post) {
    analysisWorker.pause();
    return sendJson(res, 200, analysisWorker.status());
  }

  if (url === "/api/analyse/resume" && post) {
    analysisWorker.resume();
    return sendJson(res, 200, analysisWorker.status());
  }

  if (url === "/api/analyse/queue" && post) {
    const validated = validateQueueRequest(await readJson(req));
    if (!validated.ok) return sendJson(res, 400, { error: validated.message });
    const { gameIds, depth, force, urgent, deeper } = validated.request;
    const unknown = unknownGameIds(db, gameIds);
    if (unknown.length > 0) return sendJson(res, 400, { error: unknownIdsMessage(unknown) });
    const defaultDepth = getSettings(db).depthPreset;
    enqueueGames(db, gameIds, deeper ? oneStepDeeper(defaultDepth) : depth ?? defaultDepth, force, urgent, Date.now());
    analysisWorker.notify();
    eventHub.broadcast({ type: "queue", status: analysisWorker.status() });
    eventHub.broadcast({ type: "gamesChanged" });
    return sendJson(res, 200, analysisWorker.status());
  }

  if (url === "/api/games/delete" && post) {
    const validated = validateDeleteRequest(await readJson(req));
    if (!validated.ok) return sendJson(res, 400, { error: validated.message });
    for (const id of validated.ids) analysisWorker.abortGame(id);
    const deleted = deleteGames(db, validated.ids);
    eventHub.broadcast({ type: "gamesChanged" });
    return sendJson(res, 200, { deleted });
  }

  if (url === "/api/games/delete-all" && post) {
    const running = analysisWorker.status().running;
    if (running) analysisWorker.abortGame(running.gameId);
    deleteAllData(db);
    eventHub.broadcast({ type: "gamesChanged" });
    return sendJson(res, 200, { ok: true });
  }

  if (url.startsWith("/api/explore/dests") && get) return sendJson(res, 200, legalDestinations(searchParams(url).get("fen") ?? ""));

  if (url === "/api/explore/move" && post) {
    const b = asObject(await readJson(req));
    if (typeof b.fen !== "string" || typeof b.uci !== "string") return sendJson(res, 400, { error: '"fen" and "uci" must be strings' });
    return sendJson(res, 200, applyMove(b.fen, b.uci));
  }

  if (url === "/api/explore/search" && post) {
    const b = asObject(await readJson(req));
    if (typeof b.fen !== "string" || (b.sideToMove !== "w" && b.sideToMove !== "b") || typeof b.clientId !== "string" || typeof b.requestId !== "string") {
      return sendJson(res, 400, { error: '"fen", "sideToMove" ("w"/"b"), "clientId" and "requestId" are required' });
    }
    return sendJson(res, 200, exploreSession.start({ fen: b.fen, sideToMove: b.sideToMove, clientId: b.clientId, requestId: b.requestId }));
  }

  if (url === "/api/explore/stop" && post) {
    exploreSession.stop();
    return sendJson(res, 200, { ok: true });
  }

  if (url.startsWith("/api/")) return sendJson(res, 404, { error: "not found" });

  await serveStatic(staticRoot, req, res);
});

if (process.env.NODE_ENV !== "test") {
  server.listen(port, () => {
    console.log(`listening on http://localhost:${port}`);
  });

  // Node does not apply the default "terminate" signal disposition when it
  // is PID 1 (as it is inside a container), so without a handler SIGTERM is
  // silently ignored and the container never stops cleanly.
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
