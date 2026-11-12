import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSettingsUpdate, DEFAULT_SETTINGS } from "../../src/server/settings.ts";

test("an empty update keeps the current settings", () => {
  const current = { usernames: ["bc_tester"], depthPreset: "deep" as const, autoAnalyse: false, autoSyncHours: 6 };
  const result = validateSettingsUpdate({}, current);
  assert.deepEqual(result, { ok: true, settings: current });
});

test("body missing or not an object", () => {
  const result = validateSettingsUpdate(undefined, DEFAULT_SETTINGS);
  assert.deepEqual(result, { ok: false, message: "JSON body required" });
});

test("usernames: trimmed, lower-cased and de-duplicated", () => {
  const result = validateSettingsUpdate({ usernames: ["  BC_Tester  ", "bc_tester", "Other_One"] }, DEFAULT_SETTINGS);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.settings.usernames, ["bc_tester", "other_one"]);
});

test("usernames: must be a string array", () => {
  for (const usernames of [42, "bc_tester", [1, 2]]) {
    const result = validateSettingsUpdate({ usernames }, DEFAULT_SETTINGS);
    assert.deepEqual(result, { ok: false, message: "usernames must be a string array" });
  }
});

test("usernames: each must be a valid chess.com username", () => {
  const result = validateSettingsUpdate({ usernames: ["bc_tester", "a"] }, DEFAULT_SETTINGS);
  assert.deepEqual(result, { ok: false, message: '"a" is not a chess.com username (3-25 letters, digits, "_" or "-")' });
});

test("usernames: at most 10", () => {
  const usernames = Array.from({ length: 11 }, (_, i) => `user${i}`);
  const result = validateSettingsUpdate({ usernames }, DEFAULT_SETTINGS);
  assert.deepEqual(result, { ok: false, message: "at most 10 usernames" });
});

test("usernames: 10 after de-duplication is fine", () => {
  const usernames = [...Array.from({ length: 10 }, (_, i) => `user${i}`), "user0"]; // 11 raw, 10 unique
  const result = validateSettingsUpdate({ usernames }, DEFAULT_SETTINGS);
  assert.equal(result.ok, true);
});

test("depthPreset: quick/standard/deep accepted, anything else rejected", () => {
  for (const depthPreset of ["quick", "standard", "deep"]) {
    const result = validateSettingsUpdate({ depthPreset }, DEFAULT_SETTINGS);
    assert.equal(result.ok, true);
  }
  const result = validateSettingsUpdate({ depthPreset: "slow" }, DEFAULT_SETTINGS);
  assert.deepEqual(result, { ok: false, message: "unknown depthPreset" });
});

test("autoAnalyse: coerced to a boolean", () => {
  const result = validateSettingsUpdate({ autoAnalyse: 0 }, DEFAULT_SETTINGS);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.settings.autoAnalyse, false);
});

test("autoSyncHours: one of Off, 1, 3, 6, 12 or 24 hours", () => {
  for (const autoSyncHours of [0, 1, 3, 6, 12, 24]) {
    const result = validateSettingsUpdate({ autoSyncHours }, DEFAULT_SETTINGS);
    assert.ok(result.ok && result.settings.autoSyncHours === autoSyncHours);
  }
  for (const autoSyncHours of [2, -1, "6", 48]) assert.equal(validateSettingsUpdate({ autoSyncHours }, DEFAULT_SETTINGS).ok, false);
});
