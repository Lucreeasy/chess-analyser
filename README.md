# Chess analyser

Import your chess.com games, analyse them with Stockfish, review them move by move, see insights into your
play, and train puzzles made from your own mistakes. Runs entirely on your own machine: no accounts, no
cloud sync, nothing leaves it except requests to chess.com's public API.

**Stack:** one TypeScript codebase — a Node.js server (SQLite storage, a Stockfish engine driven over UCI)
and a Svelte + Vite frontend.

## Run it (Docker / Podman)

```bash
docker compose up --build
```

The app serves at `http://localhost:3000`. Game data lives in the `data` volume, so it survives a restart
or an image update.

Configuration is by environment variables (all optional, with working defaults): `PORT` (default `3000`),
`DATA_DIR` (default `/data`), `STATIC_DIR` (where the built frontend is served from), `ENGINE_PATH`
(default `/usr/local/bin/stockfish`, where the image's own build of Stockfish 18 lives), `ENGINE_THREADS`
(default `2`), `ENGINE_HASH_MB` (default `128`). The chess.com auto-sync interval is chosen in Settings.

Image size: about 375 MB (most of it Stockfish's neural network file). Tested on `linux/amd64`;
`linux/arm64` is built by CI (see the workflow once it exists).

**Podman note:** if `docker compose build` prints a warning that `HEALTHCHECK is not supported for OCI
image format`, Podman is building in OCI format by default. Either set
`image_build_format = "docker"` under `[engine]` in `~/.config/containers/containers.conf`, or build once
with `BUILDAH_FORMAT=docker docker compose build`.

## Develop on the machine (without Docker)

Needs Node.js 22.6 or newer (the server runs `.ts` files directly; no separate build/watch tool).

```bash
npm install
npm run dev          # the server, with auto-restart on save
npm run build:web    # builds the frontend once, into dist/web
```

## Tests

```bash
npm test             # all unit/integration tests, no Docker and no engine needed
npm run typecheck    # type-checks the whole project
npm run smoke        # builds the image, starts it, imports a sample game and lists it (needs Docker or Podman)
```

## Licence

MIT — see `LICENSE`.
