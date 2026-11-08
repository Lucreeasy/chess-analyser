import { test } from "node:test";
import assert from "node:assert/strict";
import { drilldownLists } from "../../../src/server/insights/drilldown.ts";
import { openings } from "../../../src/server/insights/openings.ts";
import { conversion, tilt } from "../../../src/server/insights/conversion.ts";
import { timeStats } from "../../../src/server/insights/time.ts";
import type { UsedGame } from "../../../src/server/insights/select.ts";
import { used } from "./fixtures.ts";

function lists(games: UsedGame[]) {
  const c = conversion(games);
  return drilldownLists(games, { openings: openings(games), conversion: c.conversion, resilience: c.resilience, time: timeStats(games), tilt: tilt(games) });
}

test("15.1 example: blunders per game 1, 3, 2, 3 -> g3, g1, g2, g0 (weight first, then newest)", () => {
  const g = [1, 3, 2, 3].map((n, i) => used(`g${i}`, { moves: Array.from({ length: n }, () => [{ classification: "blunder" as const, phase: "middlegame" as const }, {}]).flat() }));
  const l = lists(g);
  assert.deepEqual(l["error:blunder"], { total: 4, ids: ["g3", "g1", "g2", "g0"] });
  assert.deepEqual(l["error:blunder:middlegame"].ids, ["g3", "g1", "g2", "g0"]);
  assert.deepEqual(l.all.ids, ["g3", "g2", "g1", "g0"]);
  assert.equal(l["error:mistake"], undefined); // no games behind the number: no list
  assert.deepEqual(l["color:w"].ids, ["g3", "g2", "g1", "g0"]);
  assert.equal(l["color:b"], undefined);
});

test("15.1 example: 520 used games -> 'all' has total 520 and the 500 newest ids", () => {
  const l = lists(Array.from({ length: 520 }, (_, i) => used(`g${i}`, { moves: [{}] })));
  assert.equal(l.all.total, 520);
  assert.equal(l.all.ids.length, 500);
  assert.equal(l.all.ids[0], "g519");
});

test("15.1: result-based lists for conversion, resilience and lost on time", () => {
  const g = [
    used("a", { maxEp: 0.9, game: { myResult: "win" } }),
    used("b", { maxEp: 0.9, minEp: 0.1, game: { myResult: "draw" } }),
    used("c", { minEp: 0.1, game: { myResult: "loss", termination: "time" } }),
  ];
  const l = lists(g);
  assert.deepEqual(l["conversion:reached"].ids, ["b", "a"]);
  assert.deepEqual(l["conversion:won"].ids, ["a"]);
  assert.deepEqual(l["resilience:saved"].ids, ["b"]);
  assert.deepEqual(l["resilience:lost"].ids, ["c"]);
  assert.deepEqual(l["time:loss"].ids, ["c"]);
});
