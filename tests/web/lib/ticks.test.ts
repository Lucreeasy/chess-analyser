import { test } from "node:test";
import assert from "node:assert/strict";
import { niceTicks } from "../../../src/web/lib/ticks.ts";

test("niceTicks: about four round steps inside the range", () => {
  assert.deepEqual(niceTicks(90, 96), [90, 92, 94, 96]);
  assert.deepEqual(niceTicks(1540, 1620), [1540, 1560, 1580, 1600, 1620]);
  assert.deepEqual(niceTicks(1215, 1318), [1220, 1240, 1260, 1280, 1300]);
});
