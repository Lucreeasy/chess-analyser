import { test } from "node:test";
import assert from "node:assert/strict";
import { validateQueueRequest, unknownIdsMessage } from "../../../src/server/analysisQueue/requestValidation.ts";

test("a valid request with no depth/force: force defaults false, urgent from the id count", () => {
  const result = validateQueueRequest({ gameIds: ["a", "b"] });
  assert.deepEqual(result, { ok: true, request: { gameIds: ["a", "b"], depth: undefined, force: false, urgent: true } });
});

test("urgent is true at exactly 5 ids, false at 6", () => {
  const five = validateQueueRequest({ gameIds: ["a", "b", "c", "d", "e"] });
  assert.equal(five.ok, true);
  if (five.ok) assert.equal(five.request.urgent, true);

  const six = validateQueueRequest({ gameIds: ["a", "b", "c", "d", "e", "f"] });
  assert.equal(six.ok, true);
  if (six.ok) assert.equal(six.request.urgent, false);
});

test("gameIds are de-duplicated before the count check", () => {
  const result = validateQueueRequest({ gameIds: ["a", "a", "b"] });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.request.gameIds, ["a", "b"]);
});

test("body missing or not an object", () => {
  for (const body of [undefined, null, "x", 1]) {
    assert.deepEqual(validateQueueRequest(body), { ok: false, message: "JSON body required" });
  }
});

test("gameIds: must be a non-empty array of strings, up to 10000 (after de-duplication)", () => {
  for (const gameIds of [undefined, [], "a", [1, 2], Array.from({ length: 10_001 }, (_, i) => `g${i}`)]) {
    assert.deepEqual(validateQueueRequest({ gameIds }), { ok: false, message: '"gameIds" must be a non-empty array of up to 10000 game ids' });
  }
});

test("depth: must be quick/standard/deep when present", () => {
  for (const depth of ["quick", "standard", "deep"]) {
    assert.equal(validateQueueRequest({ gameIds: ["a"], depth }).ok, true);
  }
  assert.deepEqual(validateQueueRequest({ gameIds: ["a"], depth: "slow" }), {
    ok: false,
    message: '"depth" must be one of quick, standard, deep',
  });
});

test("force: must be a boolean when present", () => {
  assert.equal(validateQueueRequest({ gameIds: ["a"], force: true }).ok, true);
  assert.deepEqual(validateQueueRequest({ gameIds: ["a"], force: "yes" }), { ok: false, message: '"force" must be a boolean' });
});

test("unknownIdsMessage: count and the first three ids joined by ', '", () => {
  assert.equal(unknownIdsMessage(["a", "b"]), "unknown game ids (2): a, b");
  assert.equal(unknownIdsMessage(["a", "b", "c", "d"]), "unknown game ids (4): a, b, c");
});
