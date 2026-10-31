import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeUsernameSync } from "../../../src/server/chesscom/autoSyncResult.ts";
import type { SyncResult } from "../../../src/server/chesscom/sync.ts";

function result(months: SyncResult["months"], overrides: Partial<SyncResult> = {}): SyncResult {
  return { months, added: 0, duplicates: 0, failed: 0, ...overrides };
}

test("no problem months: no error field", () => {
  const entry = summarizeUsernameSync("bc_tester", result([{ month: "2026-09", status: "ok", message: "1 new, 0 duplicates, 0 failed" }], { added: 1 }));
  assert.deepEqual(entry, { username: "bc_tester", added: 1, duplicates: 0, failed: 0 });
});

test("a not_found month is not a problem", () => {
  const entry = summarizeUsernameSync("bc_tester", result([{ month: "2026-09", status: "not_found", message: "no games for bc_tester in 2026-09" }]));
  assert.equal(entry.error, undefined);
});

test("error and rate_limited months are joined with '; '", () => {
  const entry = summarizeUsernameSync(
    "bc_tester",
    result([
      { month: "2026-08", status: "error", message: "chess.com server error (HTTP 500)" },
      { month: "2026-09", status: "rate_limited", message: "chess.com is rate limiting requests; retry in about 16 s" },
    ]),
  );
  assert.equal(
    entry.error,
    "2026-08: chess.com server error (HTTP 500); 2026-09: chess.com is rate limiting requests; retry in about 16 s",
  );
});

test("counts pass through from the sync result", () => {
  const entry = summarizeUsernameSync("bc_tester", result([], { added: 3, duplicates: 2, failed: 1 }));
  assert.equal(entry.added, 3);
  assert.equal(entry.duplicates, 2);
  assert.equal(entry.failed, 1);
});
