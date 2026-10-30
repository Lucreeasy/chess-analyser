# syntax=docker/dockerfile:1

FROM debian:bookworm-slim AS stockfish
RUN apt-get update && apt-get install -y --no-install-recommends git build-essential ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --branch sf_18 --depth 1 https://github.com/official-stockfish/Stockfish.git /stockfish
WORKDIR /stockfish/src
# A portable baseline per architecture (no AVX/NEON feature assumptions), since the image must run
# on whatever machine pulls it.
RUN ARCH=$(case "$(dpkg --print-architecture)" in amd64) echo x86-64;; arm64) echo armv8;; *) echo x86-64;; esac) \
    && make -j"$(nproc)" build ARCH="$ARCH"

FROM node:22-bookworm-slim AS build
WORKDIR /app
# better-sqlite3 has no prebuilt binary for every target platform and compiles from source.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm run build:web
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    STATIC_DIR=/app/dist/web \
    PORT=3000 \
    ENGINE_PATH=/usr/local/bin/stockfish
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=stockfish /stockfish/src/stockfish /usr/local/bin/stockfish
COPY package.json ./
COPY src/server ./src/server
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "src/server/index.ts"]
