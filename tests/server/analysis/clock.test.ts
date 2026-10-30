import { test } from "node:test";
import assert from "node:assert/strict";
import { parseClockMs, parseTimeControl, deriveClocks } from "../../../src/server/analysis/clock.ts";

// docs/02-ANALYSIS-SPEC.md 14.1 examples.
test("parseClockMs reads every supported format, and rejects the rest", () => {
  assert.equal(parseClockMs("[%clk 0:03:00.9]"), 180900);
  assert.equal(parseClockMs("[%clk 0:00:09.95]"), 9950);
  assert.equal(parseClockMs("[%clk 3:00]"), 180000);
  assert.equal(parseClockMs("[%clk 0:59.5]"), 59500);
  assert.equal(parseClockMs("[%clk]"), undefined);
  assert.equal(parseClockMs("[%clk abc]"), undefined);
  assert.equal(parseClockMs("[%emt 0:00:01]"), undefined);
});

// 14.2 classification.
test("parseTimeControl: daily, live, unknown", () => {
  assert.equal(parseTimeControl("1/86400").kind, "daily");
  assert.deepEqual(parseTimeControl("180+2"), { kind: "live", baseMs: 180000, incrementMs: 2000 });
  assert.deepEqual(parseTimeControl("60"), { kind: "live", baseMs: 60000, incrementMs: 0 });
  assert.equal(parseTimeControl("-").kind, "unknown");
  assert.equal(parseTimeControl("").kind, "unknown");
  assert.equal(parseTimeControl("?").kind, "unknown");
});

// 14.3 verified examples.
test("time spent: 3+2, White 180s -> 178.5s is 3500ms; Black 180 -> 181.0 is 1000ms", () => {
  const control = parseTimeControl("180+2");
  const [white, black] = deriveClocks(control, [
    { colour: "w", clockMs: 178500 },
    { colour: "b", clockMs: 181000 },
  ]);
  assert.equal(white.timeSpentMs, 3500);
  assert.equal(black.timeSpentMs, 1000);
});

test("time trouble: 10+0 clocks 59999/60000/61000/9000 -> yes/no/no/yes", () => {
  const control = parseTimeControl("600");
  const results = deriveClocks(control, [
    { colour: "w", clockMs: 59999 },
    { colour: "b", clockMs: 60000 },
    { colour: "w", clockMs: 61000 },
    { colour: "b", clockMs: 9000 },
  ]);
  assert.deepEqual(results.map((r) => r.inTimeTrouble), [true, false, false, true]);
});

test("time trouble: 1+0, the 10s floor: 9999 -> yes, 10000 -> no", () => {
  const control = parseTimeControl("60");
  const results = deriveClocks(control, [
    { colour: "w", clockMs: 9999 },
    { colour: "b", clockMs: 10000 },
  ]);
  assert.deepEqual(results.map((r) => r.inTimeTrouble), [true, false]);
});

test("time trouble: 30+0, 10% = 180s: 179000ms -> yes", () => {
  const control = parseTimeControl("1800");
  const [result] = deriveClocks(control, [{ colour: "w", clockMs: 179000 }]);
  assert.equal(result.inTimeTrouble, true);
});

test("time spent clamps at 0: 3+2 with 182.5s after the first move", () => {
  const control = parseTimeControl("180+2");
  const [result] = deriveClocks(control, [{ colour: "w", clockMs: 182500 }]);
  assert.equal(result.timeSpentMs, 0);
});

test("flagged game 2+0, clocks 100000/100000/0: last ply spent 100000, in trouble", () => {
  const control = parseTimeControl("120");
  const results = deriveClocks(control, [
    { colour: "w", clockMs: 100000 },
    { colour: "b", clockMs: 100000 },
    { colour: "w", clockMs: 0 },
  ]);
  const last = results[2];
  assert.equal(last.timeSpentMs, 100000);
  assert.equal(last.inTimeTrouble, true);
});

test("daily games carry no clock data at all, even with a clock comment", () => {
  const control = parseTimeControl("1/86400");
  const [result] = deriveClocks(control, [{ colour: "w", clockMs: 12345 }]);
  assert.deepEqual(result, {});
});

test("unknown time control keeps only the raw clock", () => {
  const control = parseTimeControl("-");
  const [result] = deriveClocks(control, [{ colour: "w", clockMs: 12345 }]);
  assert.deepEqual(result, { clockMs: 12345 });
});

test("a missing clock means no time spent for that ply and the same colour's next one", () => {
  const control = parseTimeControl("180+2");
  const results = deriveClocks(control, [
    { colour: "w", clockMs: 178500 },
    { colour: "b", clockMs: undefined },
    { colour: "w", clockMs: 176000 },
    { colour: "b", clockMs: 175000 },
  ]);
  assert.deepEqual(results[1], {});
  assert.equal(results[3].timeSpentMs, undefined); // black's previous ply had no clock
});
