# Architecture

One Node.js process serves the API, the live event stream and the built frontend, keeps everything in one
SQLite file, and drives one Stockfish process. The browser app is a Svelte single-page app that talks to
the API with relative URLs, so it works under any URL path prefix.

```
 chess.com API ──► chesscom/ ─┐
 PGN file/paste ──► import/ ──┼─► games ──► analysis queue ──► worker ──► runAnalysis ──► analyses
                              │                                   │            │             │
                              │                          engine/ (UCI) ◄── eval cache       ├─► puzzles
                              │                                                             │
                              └──────── events (SSE) ◄── progress, queue, games changed ────┘
 browser ◄── HTTP API (index.ts) ◄── games/, insights/, puzzles/, explore/ (read side)
```

## Server (`src/server/`)

- `index.ts` — the HTTP routes (plain `node:http`, no framework), start-up and shutdown. On start it puts
  any game left "running" back to waiting, then resumes the queue and auto-sync.
- `db.ts` — the SQLite schema and every query. Tables:
  - `games` (one row per game, the stored game as JSON, keyed by its stable id),
  - `analyses` (one finished analysis per game, as JSON),
  - `analysis_queue`, `queue_state` (pause flag, batch counter), `analysis_errors`,
  - `eval_cache` (engine lines per position, depth and line count; first write wins),
  - `puzzles` (content as JSON plus the schedule columns),
  - `settings` (one row), `chesscom_etags` (auto-sync's conditional requests).
- `import/` — PGN text to stored games: splitting, tags, the lenient movetext reader, replay and legality,
  players and "me" from the saved usernames, time class, termination, the opening name and the report.
- `chesscom/` — the archive and month client with retries and one shared 1-second pacer, month selection,
  the per-month sync, and the auto-sync scheduler (interval from Settings, never two runs at once).
- `analysisQueue/` — the queue rules (who goes first, merging repeated requests) and the single background
  worker that analyses one game at a time and can be paused.
- `runAnalysis.ts` — one game: replays it, gets every position's lines from the cache or the engine, and runs
  the pure analysis on them.
- `analysis/` — pure functions, no I/O: Win%, expected points, move accuracy, classification, tactic tags,
  phases, the opening book, game accuracy, key moments and the sentences shown to the user. `game.ts` puts
  them together for one game.
- `engine/` — the UCI protocol (`uci.ts` turns engine output into lines from White's point of view) and the
  engine process (`engine.ts`: one search at a time, analysis and the interactive explore search).
  `engineClient.ts` holds the one shared engine and restarts it after a crash.
- `explore/` — explore mode: legal moves and the one shared interactive search.
- `games/` — the rows the Games list and the Review screen need (positions, status, opponent).
- `insights/` — the Insights computation, pure over the stored games and analyses; `insights.ts` runs
  selection, the default date range, every section, the recommendations and the drill-down lists.
- `puzzles/` — selection from an analysis, the 1/3/7-day schedule, storage and sync after each analysis, the
  listing and the answer check (solution list first, then a cached or quick engine evaluation).
- `events/` — server-sent events to every open browser, with per-type smoothing.
- Small top-level files: `settings.ts` (the settings and their validation), `rederiveMe.ts` (which side is
  "you" when the usernames change), `static.ts` (serving the built frontend), `version.ts` (the app version
  for the live channel's greeting).

The analysis, insights and puzzle rules are pure functions over plain data, so tests run them without a
database or an engine; the engine-dependent parts take the engine (or a scripted fake) as a parameter.

## HTTP API (all JSON unless noted)

| Route | What |
|---|---|
| `GET /health` | liveness for the container health check |
| `GET /api/events` | server-sent events: `queue`, `progress`, `plyEval`, `gameAnalysed`, `importProgress`, `gamesChanged`, explore results |
| `GET /api/games`, `GET /api/games/{id}` | the library rows; one game for the Review screen |
| `POST /api/games/import` | PGN text (body) into the library |
| `POST /api/games/delete`, `POST /api/games/delete-all` | delete games / all data |
| `GET /api/chesscom/archives`, `POST /api/chesscom/import` | months of a username; import a month range |
| `GET /api/autosync/status`, `POST /api/autosync/sync-now` | auto-sync |
| `POST /api/analyse/queue`, `/pause`, `/resume`, `GET /api/analyse/status` | the analysis queue |
| `GET/POST /api/settings` | settings (partial updates) |
| `GET /api/insights` | the whole Insights answer for a filter query |
| `GET /api/puzzles`, `POST /api/puzzles/refresh`, `POST /api/puzzles/{id}/attempt` | the trainer |
| `GET /api/explore/dests`, `POST /api/explore/move`, `/search`, `/stop` | explore mode and board moves |
| anything else | the built frontend (`dist/web`), unknown paths fall back to `index.html` |

## Frontend (`src/web/`)

- `App.svelte` picks a screen from the hash route (`lib/router.svelte.ts`).
- `screens/` — Games, Import, Review, Insights, Puzzles, Settings.
- `components/` — the board (chessground), eval bar and graph, charts, tiles, panels and dialogs.
- `lib/` — plain TypeScript: formatting and wording, filters and sorting, the live event connection
  (`live.svelte.ts`), toasts and API helpers.
- `tokens.css` — colours for light and dark (following the system) and the shared styles.

The frontend imports the server's pure helpers and types where both sides need the same rule (for example
the depth presets, number formats and tag names), so a rule is written once.

## Packaging

`Dockerfile` builds Stockfish 18 from source in one stage, the frontend in another, and copies both into a
small Node.js runtime image that runs as a non-root user with a health check. `compose.yaml` adds the port
and the data volume. The server stops cleanly on `SIGTERM`: the running game goes back to waiting and is
analysed again on the next start.
