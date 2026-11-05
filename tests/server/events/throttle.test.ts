import { test } from "node:test";
import assert from "node:assert/strict";
import { Throttle, type TimerHandle } from "../../../src/server/events/throttle.ts";

interface FakeTimer extends TimerHandle {
  at: number;
  fn: () => void;
  cancelled: boolean;
}

function fakeClock() {
  let time = 0;
  const pending: FakeTimer[] = [];
  return {
    setTimer: (fn: () => void, ms: number): TimerHandle => {
      const entry: FakeTimer = { at: time + ms, fn, cancelled: false };
      pending.push(entry);
      return entry;
    },
    advance: (ms: number) => {
      time += ms;
      for (const entry of [...pending]) {
        if (!entry.cancelled && entry.at <= time) {
          pending.splice(pending.indexOf(entry), 1);
          entry.fn();
        }
      }
    },
  };
}

// docs/03-IMPORT-SPEC.md section 5.6: leading-and-trailing smoothing.
test("Throttle: the first push sends immediately", () => {
  const clock = fakeClock();
  const sent: number[] = [];
  const t = new Throttle<number>(100, (v) => sent.push(v), { setTimer: clock.setTimer });

  t.push(1);
  assert.deepEqual(sent, [1]);
});

test("Throttle: pushes inside the window are merged, the latest wins, sent at window end", () => {
  const clock = fakeClock();
  const sent: number[] = [];
  const t = new Throttle<number>(100, (v) => sent.push(v), { setTimer: clock.setTimer });

  t.push(1);
  t.push(2);
  t.push(3);
  assert.deepEqual(sent, [1]); // only the leading push sent so far

  clock.advance(100);
  assert.deepEqual(sent, [1, 3]); // trailing push is the latest value
});

test("Throttle: no pending value means nothing extra is sent at window end", () => {
  const clock = fakeClock();
  const sent: number[] = [];
  const t = new Throttle<number>(100, (v) => sent.push(v), { setTimer: clock.setTimer });

  t.push(1);
  clock.advance(100);
  assert.deepEqual(sent, [1]);
});

test("Throttle: a push after the window reopens sends immediately again", () => {
  const clock = fakeClock();
  const sent: number[] = [];
  const t = new Throttle<number>(100, (v) => sent.push(v), { setTimer: clock.setTimer });

  t.push(1);
  clock.advance(100);
  t.push(2);
  assert.deepEqual(sent, [1, 2]);
});

test("Throttle: a trailing send reopens its own window", () => {
  const clock = fakeClock();
  const sent: number[] = [];
  const t = new Throttle<number>(100, (v) => sent.push(v), { setTimer: clock.setTimer });

  t.push(1);
  t.push(2); // pending, sent as the trailing value at +100
  clock.advance(100);
  assert.deepEqual(sent, [1, 2]);

  t.push(3); // another push right after the trailing send is buffered again
  t.push(4);
  clock.advance(100);
  assert.deepEqual(sent, [1, 2, 4]);
});
