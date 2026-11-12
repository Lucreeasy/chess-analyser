export interface TimerHandle {
  unref?: () => void;
}

export interface ThrottleDeps {
  setTimer?: (fn: () => void, ms: number) => TimerHandle;
}

/**
 * Leading-and-trailing smoothing for one event stream.
 * "the first event goes out at once, events inside the window
 * are merged into one at the end of the window so the final state is never
 * lost."
 */
export class Throttle<T> {
  readonly #windowMs: number;
  readonly #send: (value: T) => void;
  readonly #setTimer: (fn: () => void, ms: number) => TimerHandle;

  #timer: TimerHandle | null = null;
  #pending: T | undefined;
  #hasPending = false;

  constructor(windowMs: number, send: (value: T) => void, deps: ThrottleDeps = {}) {
    this.#windowMs = windowMs;
    this.#send = send;
    this.#setTimer = deps.setTimer ?? setTimeout;
  }

  push(value: T): void {
    if (this.#timer === null) {
      this.#send(value);
      this.#timer = this.#setTimer(() => this.#flush(), this.#windowMs);
    } else {
      this.#pending = value;
      this.#hasPending = true;
    }
  }

  #flush(): void {
    this.#timer = null;
    if (this.#hasPending) {
      const value = this.#pending!;
      this.#hasPending = false;
      this.#pending = undefined;
      this.#send(value);
      this.#timer = this.#setTimer(() => this.#flush(), this.#windowMs);
    }
  }
}
