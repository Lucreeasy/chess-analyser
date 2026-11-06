import { test } from "node:test";
import assert from "node:assert/strict";
import { clampPly } from "../../../src/web/lib/ply.ts";

test("clampPly: NaN/non-finite becomes 0", () => {
  assert.equal(clampPly(NaN, 40), 0);
  assert.equal(clampPly(Infinity, 40), 0);
});

test("clampPly: negative clamps to 0", () => {
  assert.equal(clampPly(-5, 40), 0);
});

test("clampPly: out of range clamps to the last ply", () => {
  assert.equal(clampPly(999, 40), 40);
});

test("clampPly: in range is unchanged", () => {
  assert.equal(clampPly(12, 40), 12);
  assert.equal(clampPly(0, 40), 0);
  assert.equal(clampPly(40, 40), 40);
});
