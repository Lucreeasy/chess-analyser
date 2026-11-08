import { test } from "node:test";
import assert from "node:assert/strict";
import { ukDate, accuracyText } from "../../../src/web/lib/format.ts";

test("accuracyText: one decimal and a percent sign, an en dash without a value", () => {
  assert.deepEqual([accuracyText(83.94), accuracyText(undefined)], ["83.9%", "–"]);
});

test("ukDate: British style in UTC", () => {
  assert.equal(ukDate(Date.UTC(2026, 8, 3, 23, 30)), "3 Sept 2026");
});
