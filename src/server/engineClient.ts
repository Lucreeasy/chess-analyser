import { UciEngine } from "./engine/engine.ts";

// A space-separated command, so tests can point this at "node <fake-engine path>".
const [command, ...args] = (process.env.ENGINE_PATH || "stockfish").split(" ");
const threads = Number(process.env.ENGINE_THREADS) || 2;
const hashMb = Number(process.env.ENGINE_HASH_MB) || 128;

let engine: UciEngine | undefined;
let starting: Promise<UciEngine> | undefined;

/**
 * The shared engine instance, started on first use and reused after. A
 * failed start is not cached, so the next call tries a fresh process
 * ("the engine program is restarted automatically on the next use after a crash").
 */
export async function getEngine(): Promise<UciEngine> {
  if (engine) return engine;
  if (!starting) {
    starting = (async () => {
      const candidate = new UciEngine(command, args);
      await candidate.start({ threads, hashMb });
      engine = candidate;
      return candidate;
    })().finally(() => {
      starting = undefined;
    });
  }
  return starting;
}

/** Quits the shared engine, if one was started (used on shutdown and in tests). */
export async function shutdownEngine(): Promise<void> {
  await engine?.quit();
  engine = undefined;
}
