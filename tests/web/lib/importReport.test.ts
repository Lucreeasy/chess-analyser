import { test } from "node:test";
import assert from "node:assert/strict";
import { summaryLine, queuedLine, monthLabel, monthMessage, failedHeading } from "../../../src/web/lib/importReport.ts";

// docs/06-GAMES-SPEC.md section A12.4: only "duplicate" is pluralised.
test("summaryLine: pluralises only duplicate(s)", () => {
  assert.equal(summaryLine(12, 3, 1), "12 new, 3 duplicates, 1 failed");
  assert.equal(summaryLine(5, 0, 0), "5 new, 0 duplicates, 0 failed");
  assert.equal(summaryLine(0, 1, 0), "0 new, 1 duplicate, 0 failed");
});

test("queuedLine: undefined when nothing was queued, singular for 1", () => {
  assert.equal(queuedLine(0), undefined);
  assert.equal(queuedLine(1), "1 game queued for analysis.");
  assert.equal(queuedLine(2), "2 games queued for analysis.");
});

test("monthLabel: the fixed label per status", () => {
  assert.equal(monthLabel("ok"), "Imported");
  assert.equal(monthLabel("not_found"), "No games found");
  assert.equal(monthLabel("rate_limited"), "Rate limited by chess.com");
  assert.equal(monthLabel("error"), "Error");
});

test("monthMessage: echoes the report message, except rate_limited uses the fixed hint", () => {
  assert.equal(monthMessage({ month: "2024-01", status: "ok", message: "3 new, 0 duplicates, 0 failed" }), "3 new, 0 duplicates, 0 failed");
  assert.equal(monthMessage({ month: "2024-01", status: "not_found", message: "no games for alice in 2024-01" }), "no games for alice in 2024-01");
  assert.equal(monthMessage({ month: "2024-01", status: "error", message: "chess.com server error (HTTP 500)" }), "chess.com server error (HTTP 500)");
  assert.equal(
    monthMessage({ month: "2024-01", status: "rate_limited", message: "not fetched: stopped after chess.com rate limiting" }),
    "chess.com asked us to slow down. Wait a minute, then import this month again (games already imported are skipped).",
  );
});

test("failedHeading: singular/plural game(s)", () => {
  assert.equal(failedHeading(1), "1 failed game: show reasons");
  assert.equal(failedHeading(2), "2 failed games: show reasons");
});
