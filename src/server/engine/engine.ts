import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import type { EngineLineWithPv } from "../analysis/tacticTags.ts";
import { parseInfoLine, parseBestmoveLine, reduceInfoLines, type ParsedInfo } from "./uci.ts";

/**
 * Drives one UCI engine process. docs/02-ANALYSIS-SPEC.md 2.2-2.4; ANA-5/5.9
 * for the resource and availability rules.
 */
export class UciEngine {
  #process: ChildProcessWithoutNullStreams | undefined;
  #lines: ((line: string) => void)[] = [];
  #pendingReject: ((err: Error) => void) | undefined;
  #startupError: Error | undefined;
  readonly #command: string;
  readonly #args: string[];

  constructor(command: string, args: string[] = []) {
    this.#command = command;
    this.#args = args;
  }

  /**
   * Starts the engine and waits for its UCI handshake, up to 20 s (section
   * 5.9). Rejects with a clear message if the engine program cannot be
   * started at all (ANA-6).
   */
  async start(options: { threads: number; hashMb: number }): Promise<void> {
    this.#process = spawn(this.#command, this.#args);
    const rl = createInterface({ input: this.#process.stdout });
    rl.on("line", (line) => {
      for (const handler of this.#lines) handler(line);
    });
    this.#process.on("error", (err) => {
      this.#startupError = new Error(`engine unavailable: ${err.message}`);
      this.#pendingReject?.(this.#startupError);
      this.#pendingReject = undefined;
    });

    this.#send("uci");
    await this.#waitFor((line) => line === "uciok", 20000);
    this.#send(`setoption name Threads value ${options.threads}`);
    this.#send(`setoption name Hash value ${options.hashMb}`);
    this.#send("isready");
    await this.#waitFor((line) => line === "readyok", 20000);
  }

  async quit(): Promise<void> {
    this.#send("quit");
    this.#process?.kill();
  }

  /** Analyses one position. docs/02-ANALYSIS-SPEC.md 2.2 (depth presets), 2.3-2.4 (line reduction). */
  async analyse(
    fen: string,
    sideToMove: "w" | "b",
    options: { depth: number; multipv: number; movetimeMs: number },
  ): Promise<{ lines: EngineLineWithPv[]; reachedDepth: number }> {
    // No "ucinewgame": the hash is never cleared between positions (section 2.2), by design.
    this.#send(`setoption name MultiPV value ${options.multipv}`);
    this.#send(`position fen ${fen}`);

    const infos: ParsedInfo[] = [];
    const off = this.#onLine((line) => {
      const info = parseInfoLine(line);
      if (info) infos.push(info);
    });

    this.#send(`go depth ${options.depth} movetime ${options.movetimeMs}`);
    try {
      await this.#waitFor((line) => parseBestmoveLine(line) !== null, options.movetimeMs + 10000);
    } finally {
      off();
    }

    return reduceInfoLines(infos, sideToMove);
  }

  #send(command: string): void {
    this.#process?.stdin.write(`${command}\n`);
  }

  #onLine(handler: (line: string) => void): () => void {
    this.#lines.push(handler);
    return () => {
      this.#lines = this.#lines.filter((h) => h !== handler);
    };
  }

  #waitFor(matches: (line: string) => boolean, timeoutMs: number): Promise<void> {
    if (this.#startupError) return Promise.reject(this.#startupError);
    return new Promise((resolve, reject) => {
      const onReject = (err: Error) => {
        cleanup();
        reject(err);
      };
      const timeout = setTimeout(() => onReject(new Error(`engine did not answer within ${timeoutMs} ms`)), timeoutMs);
      const offLine = this.#onLine((line) => {
        if (matches(line)) {
          cleanup();
          resolve();
        }
      });
      const cleanup = () => {
        clearTimeout(timeout);
        offLine();
        this.#pendingReject = undefined;
      };
      this.#pendingReject = onReject;
    });
  }
}
