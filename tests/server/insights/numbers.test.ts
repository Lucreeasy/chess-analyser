import { test } from "node:test";
import assert from "node:assert/strict";
import { one, pct, thousands, plural } from "../../../src/server/insights/numbers.ts";

test("number formats: one decimal and whole percent, an en dash without a value", () => {
  assert.deepEqual([one(3.456), one(2), one(undefined)], ["3.5", "2.0", "–"]);
  assert.deepEqual([pct(0.253), pct(undefined)], ["25%", "–"]);
});

test("number formats: thousands separators; plural forms", () => {
  assert.equal(thousands(1234567), "1,234,567");
  assert.deepEqual([plural(1, "game"), plural(1462, "move"), plural(0, "game"), plural(3, "loss"), plural(1, "loss")], ["1 game", "1,462 moves", "0 games", "3 losses", "1 loss"]);
});
