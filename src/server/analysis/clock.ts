/**
 * Clock-derived values. docs/02-ANALYSIS-SPEC.md section 14.
 */

const CLOCK_PATTERN =
  /\[%clk\s*(\d+):(\d{1,2}):(\d{1,2})(?:\.(\d+))?\s*\]|\[%clk\s*(\d{1,2}):(\d{1,2})(?:\.(\d+))?\s*\]/;

/** Reads a "[%clk ...]" comment (section 14.1); undefined if it does not match. */
export function parseClockMs(comment: string): number | undefined {
  const match = CLOCK_PATTERN.exec(comment);
  if (!match) return undefined;
  const fractionMs = (fraction: string | undefined) => (fraction ? Math.round(Number(`0.${fraction}`) * 1000) : 0);
  if (match[1] !== undefined) {
    const [hours, minutes, seconds] = [match[1], match[2], match[3]];
    return (Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000 + fractionMs(match[4]);
  }
  const [minutes, seconds] = [match[5], match[6]];
  return (Number(minutes) * 60 + Number(seconds)) * 1000 + fractionMs(match[7]);
}

export interface TimeControl {
  kind: "unknown" | "daily" | "live";
  baseMs: number;
  incrementMs: number;
}

/** Parses the (trimmed) TimeControl header. Section 14.2. */
export function parseTimeControl(text: string): TimeControl {
  const trimmed = text.trim();
  if (trimmed.includes("/")) return { kind: "daily", baseMs: 0, incrementMs: 0 };
  const match = /^(\d+(?:\.\d+)?)(?:\+(\d+(?:\.\d+)?))?$/.exec(trimmed);
  if (!match) return { kind: "unknown", baseMs: 0, incrementMs: 0 };
  return {
    kind: "live",
    baseMs: Math.round(Number(match[1]) * 1000),
    incrementMs: Math.round(Number(match[2] ?? "0") * 1000),
  };
}

export interface PlyClockInput {
  colour: "w" | "b";
  /** The raw clock read from the move's comment, if any. */
  clockMs?: number;
}

export interface PlyClockResult {
  clockMs?: number;
  timeSpentMs?: number;
  inTimeTrouble?: boolean;
}

/** Per-ply clock, time spent and time-trouble flag, over a game's plies in order. Section 14.3. */
export function deriveClocks(control: TimeControl, plies: PlyClockInput[]): PlyClockResult[] {
  if (control.kind === "daily") return plies.map(() => ({}));

  const previousClock: Record<"w" | "b", number | undefined> = { w: control.baseMs, b: control.baseMs };
  return plies.map((ply) => {
    const before = previousClock[ply.colour];
    previousClock[ply.colour] = ply.clockMs;
    if (ply.clockMs === undefined) return {};
    if (control.kind === "unknown") return { clockMs: ply.clockMs };

    const inTimeTrouble = ply.clockMs < Math.max(0.1 * control.baseMs, 10000);
    const timeSpentMs = before === undefined ? undefined : Math.max(0, before - ply.clockMs + control.incrementMs);
    return { clockMs: ply.clockMs, timeSpentMs, inTimeTrouble };
  });
}
