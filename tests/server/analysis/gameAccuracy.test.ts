import { test } from "node:test";
import assert from "node:assert/strict";
import { gameAccuracy } from "../../../src/server/analysis/gameAccuracy.ts";

function close(got: number, expected: number, tolerance = 1e-6): void {
  assert.ok(Math.abs(got - expected) < tolerance, `got ${got}, expected ${expected}`);
}

// docs/02-ANALYSIS-SPEC.md 18.6 "Synthetic A": 8 plies, White starts.
test("Synthetic A: White 48.584310137588204, Black 86.10045751021869", () => {
  const w = [51.8402, 53.6754, 50.9204, 44.4992, 52.7588, 71.5148, 65.9883, 24.8874, 28.4852];
  const result = gameAccuracy(w, "w");
  close(result.white, 48.584310137588204, 1e-3);
  close(result.black, 86.10045751021869, 1e-3);
});

// 18.6 "Synthetic B": 5 plies, Black starts (White Win% given directly).
test("Synthetic B: White 65.68120441352738, Black 90.34693467133948", () => {
  const w = [45, 50, 30, 35, 80, 0];
  const result = gameAccuracy(w, "b");
  close(result.white, 65.68120441352738, 1e-3);
  close(result.black, 90.34693467133948, 1e-3);
});

// 18.6 "Synthetic C": window 3 with front padding, 30 plies, White starts.
test("Synthetic C: White 78.74741216102035, Black 78.51049786821076", () => {
  const w: number[] = [];
  for (let i = 0; i <= 30; i++) w.push(50 + ((37 * i) % 23) - 11);
  const result = gameAccuracy(w, "w");
  close(result.white, 78.74741216102035, 1e-3);
  close(result.black, 78.51049786821076, 1e-3);
});

// 18.6 "Cases from the old test suite".
test("old test suite cases", () => {
  close(gameAccuracy([50, 40, 45, 25], "w").white, 49.52026725938171, 1e-3);
  close(gameAccuracy([50, 40, 45, 25], "w").black, 80.81529992041436, 1e-3);

  close(gameAccuracy([50, 55, 45, 40, 70, 30, 100], "w").white, 36.50933459126344, 1e-3);
  close(gameAccuracy([50, 55, 45, 40, 70, 30, 100], "w").black, 18.128871032736473, 1e-3);

  close(gameAccuracy([50, 50, 50, 50, 50], "w").white, 100);
  close(gameAccuracy([50, 50, 50, 50, 50], "w").black, 100);

  const result = gameAccuracy([60, 50], "b");
  close(result.black, 100); // Black made no move → 100
  close(result.white, 100);
});

// 18.5 Scholar's mate: White POV Win% at every position, plies 0..7.
test("Scholar's mate: White 97.36867025660985, Black 22.904405023443147", () => {
  const w = [52.7588, 52.7588, 53.6754, 52.2997, 52.4834, 50.9204, 97.5447, 100.0];
  const result = gameAccuracy(w, "w");
  close(result.white, 97.36867025660985, 1e-3);
  close(result.black, 22.904405023443147, 1e-3);
});

test("an empty game (0 plies) gives both colours 100", () => {
  const result = gameAccuracy([50], "w");
  assert.equal(result.white, 100);
  assert.equal(result.black, 100);
});
