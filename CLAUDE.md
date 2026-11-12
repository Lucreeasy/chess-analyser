# Instructions for Claude

A personal chess game analyser: imports chess.com games, analyses them with Stockfish, and gives a games
library, a review screen, insights and a puzzle trainer. Single-user, self-hosted, delivered as a Docker
image.

## Commands

Run from the repository root:

- Install dependencies: `npm install`
- Run the program as the Docker image: `docker compose up --build`
- Start the program for development on the machine (without Docker): `npm run dev`
- Build the frontend on its own: `npm run build:web`
- Run all tests: `npm test`
- Type-check: `npm run typecheck`
- Fill a database with 60 seeded analysed games, to look at Insights and Puzzles without the engine:
  `node tests/server/insights/fixtures.ts data/games.db`
- Build the image on its own: `docker build -t chess-analyser .`
- Smoke test of the image (build, start, health, import a sample PGN, list games): `npm run smoke`
  (`DOCKER=podman npm run smoke` with Podman).

## Structure

- `src/server/` — the Node.js server: HTTP routing (`index.ts`), SQLite storage (`db.ts`), static files
  (`static.ts`), the engine instance (`engineClient.ts`), one game through the engine (`runAnalysis.ts`),
  settings (`settings.ts`), and re-deriving colour/result when the usernames change (`rederiveMe.ts`).
  - `analysis/` — move evaluation: Win%/accuracy, classification, tactic tags, phases, the opening book
    (`src/server/data/openings.json`), sentences, and the per-game orchestrator (`game.ts`).
  - `engine/` — the UCI protocol: parsing engine output (`uci.ts`), driving the process (`engine.ts`).
  - `import/` — PGN import: splitting and tags (`pgnText.ts`), lenient movetext (`movetext.ts`), replay
    (`replay.ts`), header reading, identity and opening, and the per-game/report assembly.
  - `chesscom/` — the chess.com client, retry/backoff, the shared request pacer, month selection, the
    per-month sync and auto-sync's scheduler.
  - `analysisQueue/` — the persistent analysis queue and its single background worker.
  - `events/` — the live event channel (server-sent events) and its per-type smoothing.
  - `explore/` — explore mode: legal moves server-side and the one shared interactive engine search.
  - `games/` — the rows the Games list and the Review screen need.
  - `puzzles/` — the puzzle trainer: which mistakes become puzzles (`select.ts`), the 1/3/7-day schedule
    (`schedule.ts`), storage and sync with each analysis (`store.ts`), listing (`list.ts`) and the answer
    check (`check.ts`).
  - `insights/` — the Insights computation: selection and filters, overview, openings, time,
    conversion, trend, style and playstyle, recommendations, drill-down lists (`insights.ts` runs it all).
- `src/web/` — the Svelte + Vite frontend: `screens/` (one per route), `components/`, `lib/` (plain
  TypeScript: formatting, filters, sorting, routing, live updates) and `tokens.css` (design tokens and
  shared styles). Built into `dist/web`, which the server serves as a single-page app.
- `tests/server/`, `tests/web/` — tests, mirroring `src/`; `tests/fixtures/` holds the fake engines and
  the sample PGN files (kept byte-identical by `.gitattributes`).
- `Dockerfile`, `compose.yaml` — the packaging.

## Conventions

- One language, TypeScript, run directly by Node (type stripping) — no transpile step for the server, no
  `tsx`/`ts-node`. `tsc --noEmit` is used only for type-checking.
- Tests use `node:test` and `node:assert/strict`, one `.test.ts` file per source file under `tests/`,
  mirroring `src/`. No test framework dependency.
- The frontend fetches the API with **relative** URLs (e.g. `"api/games"`, not `"/api/games"`) so the app
  keeps working when served under a URL path prefix.
- The server is PID 1 inside the container: it registers explicit `SIGTERM`/`SIGINT` handlers that close
  the HTTP server and the database before exiting, otherwise the process would ignore the signal and the
  container would need to be killed.

## Domain rules that must not drift

The exact formulas for move evaluation (Win%, accuracy, move classes, tactic tags), the insights
definitions and the puzzle spaced-repetition schedule are pinned by the tests under `tests/`. Before
changing any of them, find the test(s) that cover the old numbers and update them deliberately, not as a
side effect.

## How to work on this project

- Make small changes: one logical change per commit, with a message that says what and why.
- Before adding code, look at the whole project for a simpler way: reuse what exists, delete or merge
  before adding, prefer the standard library and platform over a new dependency.
- Run what you build; for UI changes, look at the result on a phone-sized and a desktop-sized screen,
  light and dark.
- Keep `README.md`, `docs/ARCHITECTURE.md` and this file in step with the code.
- Record decisions that shape the project in `docs/DECISIONS.md`.
