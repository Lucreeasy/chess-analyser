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
- Build the image on its own: `docker build -t chess-analyser .`
- Smoke test of the image (start, health, import a sample game, list games): not written yet.

## Structure

- `src/server/` — the Node.js server: HTTP routing (`index.ts`), SQLite storage (`db.ts`), static-file
  serving for the built frontend (`static.ts`), the engine client/lifecycle (`engineClient.ts`), running
  one game through the engine (`runAnalysis.ts`).
  - `analysis/` — the move-evaluation pipeline (docs/02-ANALYSIS-SPEC.md): Win%/accuracy, classification,
    tactic tags, phases, the opening book, the evaluation cache, text/sentence building, and the
    per-move/per-game orchestrator (`game.ts`).
  - `engine/` — the UCI protocol: parsing/reducing engine output (`uci.ts`) and driving the engine
    process (`engine.ts`).
  - `import/` — the PGN import pipeline (docs/03-IMPORT-SPEC.md): splitting text into games and reading
    tags (`pgnText.ts`), the lenient movetext tokenizer (`movetext.ts`), start-position/legality replay
    (`replay.ts`), header interpretation (`dateTime.ts`, `players.ts`, `timeClass.ts`, `termination.ts`),
    identity/opening classification (`identity.ts`, `opening.ts`), and the per-game/report assembly
    (`parseGame.ts`, `report.ts`).
- `src/web/` — the Svelte + Vite frontend (`App.svelte`, `main.ts`, `index.html`). Built into `dist/web`,
  which the server serves as a single-page app (unknown paths fall back to `index.html`).
- `tests/server/` — tests for the server, run with Node's own test runner.
- `Dockerfile`, `compose.yaml` — the packaging (see `docs/ARCHITECTURE.md` once it exists for more).

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
