import { test } from "node:test";
import assert from "node:assert/strict";
import { validateImportRequest } from "../../../src/server/chesscom/requestValidation.ts";

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { username: "bc_tester", from: "2026-07", to: "2026-09", timeClasses: ["bullet", "blitz", "rapid"], ...overrides };
}

test("a valid request is accepted, username lower-cased and trimmed", () => {
  const result = validateImportRequest(validBody({ username: "  BC_Tester  " }));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.request.username, "bc_tester");
    assert.equal(result.request.from, "2026-07");
    assert.equal(result.request.to, "2026-09");
    assert.deepEqual(result.request.timeClasses, new Set(["bullet", "blitz", "rapid"]));
  }
});

test("body missing or not an object", () => {
  for (const body of [undefined, null, "a string", 42]) {
    const result = validateImportRequest(body);
    assert.deepEqual(result, { ok: false, status: 400, message: "JSON body required" });
  }
});

test("username not 3-25 letters, digits, _ or -", () => {
  const result = validateImportRequest(validBody({ username: "a" }));
  assert.deepEqual(result, { ok: false, status: 400, message: 'username must be 3-25 letters, digits, "_" or "-"' });
});

test("from/to missing or not YYYY-MM with month 01-12", () => {
  for (const overrides of [{ from: undefined }, { to: "2026-13" }, { from: "not-a-month" }]) {
    const result = validateImportRequest(validBody(overrides));
    assert.deepEqual(result, { ok: false, status: 400, message: '"from" and "to" must be months like "2026-09"' });
  }
});

test('"from" after "to"', () => {
  const result = validateImportRequest(validBody({ from: "2026-10", to: "2026-09" }));
  assert.deepEqual(result, { ok: false, status: 400, message: '"from" must not be after "to"' });
});

test("timeClasses missing, empty, or containing an unknown class", () => {
  for (const overrides of [{ timeClasses: undefined }, { timeClasses: [] }, { timeClasses: ["bullet", "weekly"] }]) {
    const result = validateImportRequest(validBody(overrides));
    assert.deepEqual(result, {
      ok: false,
      status: 400,
      message: '"timeClasses" must be a non-empty list of: bullet, blitz, rapid, daily, classical',
    });
  }
});

test("classical is an accepted time class even though the UI checkboxes never send it", () => {
  const result = validateImportRequest(validBody({ timeClasses: ["classical"] }));
  assert.equal(result.ok, true);
});
