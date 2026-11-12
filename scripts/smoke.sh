#!/usr/bin/env bash
# Smoke test of the image: build it, start it, wait for /health, import a sample PGN, list the games.
# Usage: npm run smoke   (DOCKER=podman to use Podman, SMOKE_PORT to change the port, default 3999)
set -euo pipefail
cd "$(dirname "$0")/.."
DOCKER=${DOCKER:-docker}
PORT=${SMOKE_PORT:-3999}
NAME=chess-analyser-smoke

$DOCKER build -t chess-analyser:smoke .
$DOCKER run -d --rm --name "$NAME" -p "$PORT:3000" chess-analyser:smoke >/dev/null
trap '$DOCKER stop "$NAME" >/dev/null' EXIT

for _ in $(seq 1 60); do curl -sf "localhost:$PORT/health" >/dev/null && break; sleep 1; done
curl -sf "localhost:$PORT/health" >/dev/null || { echo "smoke: /health never answered"; exit 1; }

added=$(curl -sf -X POST --data-binary @tests/fixtures/pgn/special-moves.pgn "localhost:$PORT/api/games/import" | grep -o '"added":[0-9]*')
listed=$(curl -sf "localhost:$PORT/api/games" | grep -o '"id":' | wc -l)
[ "$added" = '"added":5' ] && [ "$listed" -eq 5 ] || { echo "smoke: expected 5 games, import said $added, list has $listed"; exit 1; }
echo "smoke: OK (health, import of 5 games, list of 5 games)"
