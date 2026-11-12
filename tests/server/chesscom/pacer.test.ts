import { test } from "node:test";
import assert from "node:assert/strict";
import { RequestPacer } from "../../../src/server/chesscom/pacer.ts";

function fakeClock() {
  let time = 0;
  const sleeps: number[] = [];
  return {
    now: () => time,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      time += ms;
    },
    advance: (ms: number) => {
      time += ms;
    },
    sleeps,
  };
}

// "at least 1 second between requests... measured from the end
// of the previous attempt to the start of the next".
test("the gap is measured from the end of the previous call to the start of the next", async () => {
  const clock = fakeClock();
  const pacer = new RequestPacer(1000, clock.now, clock.sleep);
  const starts: number[] = [];

  const first = pacer.run(async () => {
    starts.push(clock.now());
    clock.advance(100); // the call itself takes 100ms
  });
  await first;
  const second = pacer.run(async () => {
    starts.push(clock.now());
  });
  await second;

  assert.deepEqual(starts, [0, 1100]); // 0 + 100 (duration) + 1000 (gap)
  assert.deepEqual(clock.sleeps, [1000]);
});

test("no wait is needed once the gap has already elapsed", async () => {
  const clock = fakeClock();
  const pacer = new RequestPacer(1000, clock.now, clock.sleep);

  await pacer.run(async () => {});
  clock.advance(5000); // plenty of time passes between calls
  const starts: number[] = [];
  await pacer.run(async () => starts.push(clock.now()));

  assert.deepEqual(clock.sleeps, []);
  assert.deepEqual(starts, [5000]);
});

test("one request at a time: calls never overlap, even if fired without waiting", async () => {
  const clock = fakeClock();
  const pacer = new RequestPacer(0, clock.now, clock.sleep);
  const events: string[] = [];

  const slow = pacer.run(async () => {
    events.push("slow-start");
    await new Promise((resolve) => setTimeout(resolve, 5));
    events.push("slow-end");
  });
  const fast = pacer.run(async () => {
    events.push("fast-start");
    events.push("fast-end");
  });
  await Promise.all([slow, fast]);

  assert.deepEqual(events, ["slow-start", "slow-end", "fast-start", "fast-end"]);
});

test("concurrent callers queue up in call order", async () => {
  const clock = fakeClock();
  const pacer = new RequestPacer(0, clock.now, clock.sleep);
  const order: number[] = [];

  const calls = [1, 2, 3].map((n) => pacer.run(async () => void order.push(n)));
  await Promise.all(calls);

  assert.deepEqual(order, [1, 2, 3]);
});

test("a failed call still records its end time, so the next call still waits out the gap", async () => {
  const clock = fakeClock();
  const pacer = new RequestPacer(1000, clock.now, clock.sleep);

  await assert.rejects(pacer.run(async () => { throw new Error("boom"); }));
  const starts: number[] = [];
  await pacer.run(async () => starts.push(clock.now()));

  assert.deepEqual(clock.sleeps, [1000]);
  assert.deepEqual(starts, [1000]);
});
