import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultRange, monthsInRange, autoSyncMonths } from "../../../src/server/chesscom/monthRange.ts";

test("defaultRange: To is newest, From is third newest", () => {
  assert.deepEqual(defaultRange(["2026-01", "2026-02", "2026-03", "2026-04"]), { from: "2026-02", to: "2026-04" });
});

test("defaultRange: fewer than three months, From is the oldest", () => {
  assert.deepEqual(defaultRange(["2026-03", "2026-04"]), { from: "2026-03", to: "2026-04" });
  assert.deepEqual(defaultRange(["2026-04"]), { from: "2026-04", to: "2026-04" });
});

test("defaultRange: no months at all", () => {
  assert.equal(defaultRange([]), undefined);
});

test("monthsInRange: clamps to the months the player really has", () => {
  const available = ["2026-01", "2026-03", "2026-04"];
  assert.deepEqual(monthsInRange(available, "2026-01", "2026-04"), ["2026-01", "2026-03", "2026-04"]);
  assert.deepEqual(monthsInRange(available, "2025-01", "2026-03"), ["2026-01", "2026-03"]);
  assert.deepEqual(monthsInRange(available, "2026-02", "2026-02"), []);
});

test("monthsInRange: a range with no available months is empty", () => {
  assert.deepEqual(monthsInRange([], "2026-01", "2026-04"), []);
});

// The documented examples.
test("autoSyncMonths: the current month, plus the previous one on the 1st-3rd", () => {
  assert.deepEqual(autoSyncMonths(new Date(Date.UTC(2026, 9, 28))), ["2026-10"]);
  assert.deepEqual(autoSyncMonths(new Date(Date.UTC(2026, 9, 4))), ["2026-10"]);
  assert.deepEqual(autoSyncMonths(new Date(Date.UTC(2026, 9, 3, 23, 59))), ["2026-09", "2026-10"]);
  assert.deepEqual(autoSyncMonths(new Date(Date.UTC(2026, 0, 1))), ["2025-12", "2026-01"]);
  assert.deepEqual(autoSyncMonths(new Date(Date.UTC(2026, 2, 2))), ["2026-02", "2026-03"]);
});
