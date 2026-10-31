import { test } from "node:test";
import assert from "node:assert/strict";
import { SEARCH_DEPTH, oneStepDeeper } from "../../../src/server/analysisQueue/depthPresets.ts";

test("SEARCH_DEPTH: quick 12, standard 16, deep 20", () => {
  assert.deepEqual(SEARCH_DEPTH, { quick: 12, standard: 16, deep: 20 });
});

// docs/03-IMPORT-SPEC.md section 5.5: quick -> standard, standard -> deep, deep -> deep.
test("oneStepDeeper", () => {
  assert.equal(oneStepDeeper("quick"), "standard");
  assert.equal(oneStepDeeper("standard"), "deep");
  assert.equal(oneStepDeeper("deep"), "deep");
});
