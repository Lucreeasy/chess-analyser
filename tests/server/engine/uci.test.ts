import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInfoLine, parseBestmoveLine, reduceInfoLines, type ParsedInfo } from "../../../src/server/engine/uci.ts";

// docs/02-ANALYSIS-SPEC.md section 2.4.
test("parseInfoLine: a normal cp line", () => {
  const info = parseInfoLine("info depth 10 seldepth 12 multipv 1 score cp 30 nodes 1000 nps 50000 pv e2e4 e7e5");
  assert.deepEqual(info, { depth: 10, multipv: 1, cp: 30, mate: undefined, pv: ["e2e4", "e7e5"] });
});

test("parseInfoLine: a mate score, and multipv defaults to 1", () => {
  const info = parseInfoLine("info depth 5 score mate 3 pv h5f7");
  assert.deepEqual(info, { depth: 5, multipv: 1, cp: undefined, mate: 3, pv: ["h5f7"] });
});

test("parseInfoLine: ignored - a bound score, no pv, no score, or not an info line", () => {
  assert.equal(parseInfoLine("info depth 10 multipv 1 score cp 30 lowerbound pv e2e4"), null);
  assert.equal(parseInfoLine("info depth 10 multipv 1 score cp 30"), null);
  assert.equal(parseInfoLine("info depth 10 multipv 1 pv e2e4"), null);
  assert.equal(parseInfoLine("bestmove e2e4"), null);
});

test("parseBestmoveLine", () => {
  assert.equal(parseBestmoveLine("bestmove e2e4 ponder e7e5"), "e2e4");
  assert.equal(parseBestmoveLine("bestmove e2e4"), "e2e4");
  assert.equal(parseBestmoveLine("info depth 1"), null);
});

function info(depth: number, multipv: number, cp: number, pv: string[]): ParsedInfo {
  return { depth, multipv, cp, mate: undefined, pv };
}

test("reduceInfoLines: keeps the deepest depth where every slot is present", () => {
  const infos = [
    info(1, 1, 10, ["a"]), info(1, 2, 5, ["b"]),
    info(2, 1, 20, ["a", "c"]), info(2, 2, 8, ["b", "d"]),
    info(3, 1, 30, ["a", "c", "e"]), // slot 2 of depth 3 never arrives (search cut off mid-iteration)
  ];
  const { lines, reachedDepth } = reduceInfoLines(infos, "w");
  assert.equal(reachedDepth, 2); // depth 3 is incomplete, so depth 2 is used
  assert.deepEqual(lines, [{ cp: 20, pv: ["a", "c"] }, { cp: 8, pv: ["b", "d"] }]);
});

test("reduceInfoLines: the latest line at a (depth, slot) wins", () => {
  const infos = [info(5, 1, 10, ["a"]), info(5, 1, 15, ["a", "b"])]; // a later, better-refined line at the same depth
  const { lines } = reduceInfoLines(infos, "w");
  assert.deepEqual(lines, [{ cp: 15, pv: ["a", "b"] }]);
});

test("reduceInfoLines: no depth complete falls back to the deepest with slot 1, up to the first missing slot", () => {
  const infos = [info(1, 1, 10, ["a"]), info(2, 1, 20, ["a", "b"])]; // slot 2 never arrived at any depth
  const { lines, reachedDepth } = reduceInfoLines(infos, "w");
  assert.equal(reachedDepth, 2);
  assert.deepEqual(lines, [{ cp: 20, pv: ["a", "b"] }]);
});

test("reduceInfoLines: converts the score to White's POV, and -0 becomes 0", () => {
  const infos = [info(5, 1, 30, ["a"])];
  assert.deepEqual(reduceInfoLines(infos, "b").lines, [{ cp: -30, pv: ["a"] }]);
  const zero = [info(5, 1, 0, ["a"])];
  assert.equal(reduceInfoLines(zero, "b").lines[0].cp, 0);
});

test("reduceInfoLines: a single legal move yields one line", () => {
  const infos = [info(10, 1, 50, ["only"])];
  const { lines } = reduceInfoLines(infos, "w");
  assert.equal(lines.length, 1);
});

test("reduceInfoLines: no info at all yields no lines", () => {
  assert.deepEqual(reduceInfoLines([], "w"), { lines: [], reachedDepth: 0 });
});
