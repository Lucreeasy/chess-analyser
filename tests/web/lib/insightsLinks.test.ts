import { test } from "node:test";
import assert from "node:assert/strict";
import { drillLink } from "../../../src/web/lib/insightsLinks.ts";
import { filtersFromQuery } from "../../../src/web/lib/gamesFilter.ts";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `g${i}`);
const query = (href: string) => href.slice("#/games?".length);

test("15.2: a complete list of at most 300 ids links exactly, with its label", () => {
  const link = drillLink({ total: 2, ids: ["a", "b"] }, "Games with errors", { colour: "w" })!;
  const parsed = filtersFromQuery(query(link.href));
  assert.deepEqual([...parsed.ids!], ["a", "b"]);
  assert.equal(parsed.colour, "any"); // ids alone, no other filters
  assert.equal(parsed.label, "Games with errors");
  assert.equal(link.hint, "Show the 2 games behind this number");
  assert.equal(drillLink({ total: 1, ids: ["a"] }, "x", {})!.hint, "Show the 1 game behind this number");
});

test("15.2: a longer list falls back to the dashboard filters, analysed games only, marked approximate", () => {
  const link = drillLink({ total: 520, ids: ids(500) }, "Games with errors", { timeClasses: ["blitz"], from: 5 })!;
  const parsed = filtersFromQuery(query(link.href));
  assert.deepEqual([...parsed.timeClasses], ["blitz"]);
  assert.deepEqual([parsed.from, parsed.analysis, parsed.ids], [5, "analysed", undefined]);
  assert.equal(parsed.approximate, true);
  assert.equal(link.hint, "Show games matching the filters (the exact list of 520 is too long to link)");
  assert.equal(drillLink({ total: 301, ids: ids(301) }, "x", {}, true)!.hint, "Show the 301 games behind this number");
  assert.equal(filtersFromQuery(query(drillLink({ total: 301, ids: ids(301) }, "x", {}, true)!.href)).approximate, false);
});

test("15.1: a number without games behind it has no link", () => {
  assert.equal(drillLink(undefined, "x", {}), undefined);
});
