# Decisions

One short entry per decision that shapes the project: the stack, the data store, how the engine is driven, how the UI is built, anything you could have done differently. Newest at the bottom. Keep each entry to a few lines.

Format:

```
## D-00N: <decision>
Date: <date> · Phase: <P0–P9>
Chosen: <what>
Alternatives: <what else you considered, one line each>
Why: <the reason; the simplicity argument>
```

## D-001: the stack
Date: 2026-10-30 · Phase: P0
Chosen: one language, TypeScript, on Node.js, for both server and browser.
- Server: Node.js built-in `http`/`https` for routing and server-sent events (no web framework); `better-sqlite3`
  for storage (synchronous, embedded, no separate database process); the Stockfish binary driven over UCI via
  `child_process`, a small hand-written client (few dozen lines, the protocol is simple text lines).
- Browser: Svelte (compiled away at build time, tiny runtime, no virtual DOM) with Vite as the bundler; one bundle
  for all screens (about 80 kB of JavaScript gzipped), small enough that per-screen code splitting is not needed.
  Client-side routing is a small hand-written router (the app needs relative URLs and a handful of routes; a router
  library is not needed for that).
- Chess rules: `chess.js` for move generation/legality, SAN/FEN, replay and PGN tokenising, reused everywhere a
  rules engine is needed (import validation, analysis replay, explore mode, puzzle legality) instead of a
  second hand-written rules engine for each.
- Chessboard UI: `chessground` (the board library the Lichess project publishes) for the interactive/read-only
  board, drag-and-drop, arrows and highlighting; it is framework-agnostic so it drops into Svelte directly.
- Charts (eval graph/bar, radar, trend, bars): hand-written inline SVG. The visuals are specific (custom dot
  shapes, exact colours, exact tooltips) and few in number; a charting library would need as much override code
  as drawing them directly, for one more dependency.
- Tests: Node's built-in test runner (`node:test` + `assert`) for all unit/logic tests (Win%, classification,
  insights, puzzle rules, import parsing) — no test framework dependency. Playwright (dev dependency only, not
  shipped in the image) for the few end-to-end/screenshot checks against the reference screenshots.
- Process shape: one Node.js process serves the API, the built static frontend, SSE live events and the
  single-worker analysis queue; Stockfish runs as a child process of it. One data volume holds the SQLite file.

Alternatives:
- Python (FastAPI/Flask) backend + a JS frontend — two languages, no gain since the UI needs a real browser
  framework anyway (board, charts, live regions, routing).
- Go backend + vanilla/JS frontend — a very light static binary, but still two languages, and the complex,
  accessible, highly interactive UI (explore mode, bottom sheet, charts, puzzle board) would mean either hand-
  rolling a lot of client-side state management or still ending up with a JS framework; no simplicity gain over
  one TypeScript codebase.
- React instead of Svelte — larger runtime and bundle (a virtual DOM this app does not need) and more
  boilerplate for the same screens; Svelte's compiled output is smaller and fits the "no layout shift, lazy
  per-screen code" performance goals better.
- A full chart library (Chart.js/Recharts/D3) — every chart here has bespoke marks (classification dot shapes,
  striped win/draw/loss bars, a radar with specific label layout) that would mean overriding most of the
  library's defaults anyway; plain SVG is less code for this exact set of charts.
- `node:sqlite` (Node's built-in SQLite) instead of `better-sqlite3` — still marked experimental in this Node
  version and its API may change; `better-sqlite3` is a single, stable, synchronous dependency that fits a
  one-worker queue without extra concurrency code.
- An ORM (Prisma/Drizzle/TypeORM) — the schema is small and known up front (games, analyses, puzzles, settings,
  queue, cache); a thin layer of hand-written SQL and a few typed helpers is less code and less to learn than an
  ORM's migration/query-builder machinery.
Why: meets every requirement (interactive board, live progress, charts, accessible SPA, single Docker image,
offline-testable) with one language end to end, a small and well-known dependency set, and no server framework,
ORM or chart library standing between the code and what it does.
Dependency: better-sqlite3 - synchronous embedded SQLite with no separate database process or experimental API;
chess.js - full chess rules engine (legality, SAN/FEN, replay) reused everywhere instead of writing one per
feature; chessground - the standard interactive chessboard component (drag/drop, arrows, highlights) instead of
writing a bespoke one.

## D-002: raise the size budget for the Insights phase
Date: 2026-11-08 · Phase: P6
Chosen: raise the product-lines ceiling from 11,300 to 14,500 for the length of P6, and lower it again to a
little above the real size in the phase's closing cleanup.
Alternatives: raise it a few hundred lines with every Insights commit (one decision per commit, no added
control); keep 11,300 and squeeze existing code first (the Insights screen is new behaviour the requirements
demand, not bloat to cut).
Why: the ceiling was set at the end of P5 against the code that existed then; Insights is a whole new section
(selection, ~20 metrics, the radar, 8 recommendation rules, drill-downs and its screen). One raise per phase,
tightened at the phase's end, keeps the budget meaningful without a decision per commit.

## D-003: raise the size budget for the Puzzles phase
Date: 2026-11-12 · Phase: P7
Chosen: raise the product-lines ceiling from 14,400 to 15,900 for the length of P7, and lower it again to a
little above the real size in the phase's closing cleanup, as D-002 did for Insights.
Alternatives: one raise per commit (a decision per commit, no added control); keep 14,400 and cut elsewhere
first (the trainer is new behaviour the requirements demand: selection, the schedule, the answer check with
its engine fallback, listing and its screen).
Why: one raise per phase, tightened at the phase's end, keeps the budget meaningful.

## D-004: puzzle answers are searched on the one shared engine
Date: 2026-11-12 · Phase: P7
Chosen: when an off-list puzzle answer has no stored evaluation, the quick search (depth 12, two lines,
2.5 s) runs on the program's single engine process, whose calls are serialised, under the 8 s hard timeout.
Alternatives: a second engine process reserved for interactive use (puzzles and explore), as the old app had.
Why: one Stockfish process keeps memory and code small on the target hardware; if a game analysis holds the
engine past the 8 s timeout, the answer falls back to the stored solution list and says so, the behaviour
already specified for an unavailable engine.
