/**
 * Serialises calls to one at a time, with a minimum gap between the end of
 * one call and the start of the next. docs/03-IMPORT-SPEC.md section 3.3:
 * "one request at a time, at least 1 second between requests... across ALL
 * callers because they share one client; concurrent callers queue up in
 * call order."
 */
export class RequestPacer {
  #queue: Promise<void> = Promise.resolve();
  #lastEndTime: number | undefined;
  readonly #gapMs: number;
  readonly #now: () => number;
  readonly #sleep: (ms: number) => Promise<void>;

  constructor(gapMs: number, now: () => number = Date.now, sleep: (ms: number) => Promise<void> = defaultSleep) {
    this.#gapMs = gapMs;
    this.#now = now;
    this.#sleep = sleep;
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.#queue;
    let release!: () => void;
    this.#queue = new Promise((resolve) => (release = resolve));

    return previous.then(async () => {
      if (this.#lastEndTime !== undefined) {
        const elapsed = this.#now() - this.#lastEndTime;
        if (elapsed < this.#gapMs) await this.#sleep(this.#gapMs - elapsed);
      }
      try {
        return await fn();
      } finally {
        this.#lastEndTime = this.#now();
        release();
      }
    });
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
