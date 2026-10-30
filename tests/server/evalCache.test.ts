import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, getCachedEval, putCachedEval } from "../../src/server/db.ts";

// docs/02-ANALYSIS-SPEC.md section 16.
test("miss, then a hit, keyed by (EPD, depth, multipv)", () => {
  const db = openDb(":memory:");
  const epd = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";
  assert.equal(getCachedEval(db, epd, 16, 2), undefined);

  putCachedEval(db, epd, 16, 2, [{ cp: 30, pv: ["e2e4", "e7e5"] }], 16);
  const hit = getCachedEval(db, epd, 16, 2);
  assert.deepEqual(hit?.lines, [{ cp: 30, pv: ["e2e4", "e7e5"] }]);
  assert.equal(hit?.reachedDepth, 16);
});

test("the key is the requested depth, not the depth actually reached", () => {
  const db = openDb(":memory:");
  const epd = "4k3/8/8/8/8/8/8/4K3 w - -";
  putCachedEval(db, epd, 16, 2, [{ cp: 0, pv: ["e1e2"] }], 14); // capped by the 5s time limit
  assert.equal(getCachedEval(db, epd, 16, 2)?.reachedDepth, 14);
  assert.equal(getCachedEval(db, epd, 14, 2), undefined); // a different requested depth is a different entry
});

test("a different multipv is a different entry", () => {
  const db = openDb(":memory:");
  const epd = "4k3/8/8/8/8/8/8/4K3 w - -";
  putCachedEval(db, epd, 16, 1, [{ cp: 0, pv: ["e1e2"] }], 16);
  assert.equal(getCachedEval(db, epd, 16, 2), undefined);
});

test("first write wins: an existing entry is never overwritten", () => {
  const db = openDb(":memory:");
  const epd = "4k3/8/8/8/8/8/8/4K3 w - -";
  putCachedEval(db, epd, 16, 2, [{ cp: 10, pv: ["e1e2"] }], 16);
  putCachedEval(db, epd, 16, 2, [{ cp: 999, pv: ["e1d2"] }], 16);
  assert.deepEqual(getCachedEval(db, epd, 16, 2)?.lines, [{ cp: 10, pv: ["e1e2"] }]);
});

test("an empty result is never stored", () => {
  const db = openDb(":memory:");
  const epd = "4k3/8/8/8/8/8/8/4K3 w - -";
  putCachedEval(db, epd, 16, 2, [], 16);
  assert.equal(getCachedEval(db, epd, 16, 2), undefined);
});
