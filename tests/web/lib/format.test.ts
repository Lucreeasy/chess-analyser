import { test } from "node:test";
import assert from "node:assert/strict";
import { ukDate, plural, thousands } from "../../../src/web/lib/format.ts";

test("ukDate: British style in UTC", () => {
  assert.equal(ukDate(Date.UTC(2026, 8, 3, 23, 30)), "3 Sept 2026");
});

test("thousands and plural: comma separators, singular for 1", () => {
  assert.equal(thousands(1234567), "1,234,567");
  assert.deepEqual([plural(1, "game"), plural(1462, "move"), plural(0, "game")], ["1 game", "1,462 moves", "0 games"]);
});
