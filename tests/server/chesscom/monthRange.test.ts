import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultRange, monthsInRange } from "../../../src/server/chesscom/monthRange.ts";

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
