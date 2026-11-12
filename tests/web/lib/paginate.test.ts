import { test } from "node:test";
import assert from "node:assert/strict";
import { pageCount, clampPage, paginate, PAGE_SIZE } from "../../../src/web/lib/paginate.ts";

test("PAGE_SIZE is 50", () => {
  assert.equal(PAGE_SIZE, 50);
});

// Pages = max(1, ceil(total / 50)).
test("pageCount: at least 1, even for an empty list", () => {
  assert.equal(pageCount(0), 1);
  assert.equal(pageCount(1), 1);
  assert.equal(pageCount(50), 1);
  assert.equal(pageCount(51), 2);
  assert.equal(pageCount(100), 2);
  assert.equal(pageCount(101), 3);
});

test("clampPage: never below 1, never above the last page", () => {
  assert.equal(clampPage(1, 0), 1);
  assert.equal(clampPage(0, 100), 1);
  assert.equal(clampPage(-5, 100), 1);
  assert.equal(clampPage(5, 60), 2); // only 2 pages exist
  assert.equal(clampPage(2, 60), 2);
});

test("paginate: slices 50 items per page, clamping an out-of-range page", () => {
  const items = Array.from({ length: 120 }, (_, i) => i);
  assert.deepEqual(paginate(items, 1), items.slice(0, 50));
  assert.deepEqual(paginate(items, 2), items.slice(50, 100));
  assert.deepEqual(paginate(items, 3), items.slice(100, 120));
  assert.deepEqual(paginate(items, 99), items.slice(100, 120)); // clamped to the last page
});

test("paginate: an empty list gives an empty page", () => {
  assert.deepEqual(paginate([], 1), []);
});
