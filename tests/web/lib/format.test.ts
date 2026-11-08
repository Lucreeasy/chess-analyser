import { test } from "node:test";
import assert from "node:assert/strict";
import { ukDate, plural } from "../../../src/web/lib/format.ts";

test("ukDate: British style in UTC", () => {
  assert.equal(ukDate(Date.UTC(2026, 8, 3, 23, 30)), "3 Sept 2026");
});

test("plural: singular for 1, thousands separators", () => {
  assert.deepEqual([plural(1, "game"), plural(1462, "move"), plural(0, "game")], ["1 game", "1,462 moves", "0 games"]);
});
