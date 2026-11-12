import { test } from "node:test";
import assert from "node:assert/strict";
import { ukDate, ukRange, accuracyText } from "../../../src/web/lib/format.ts";

test("accuracyText: one decimal and a percent sign, an en dash without a value", () => {
  assert.deepEqual([accuracyText(83.94), accuracyText(undefined)], ["83.9%", "–"]);
});

test("ukDate: British style in UTC", () => {
  assert.equal(ukDate(Date.UTC(2026, 8, 3, 23, 30)), "3 Sept 2026");
});

test("ukRange: two different dates with an en dash, equal dates once", () => {
  assert.equal(ukRange(Date.UTC(2026, 8, 3, 10), Date.UTC(2026, 9, 9, 10)), "3 Sept 2026 – 9 Oct 2026");
  assert.equal(ukRange(Date.UTC(2026, 8, 3, 1), Date.UTC(2026, 8, 3, 22)), "3 Sept 2026");
});
