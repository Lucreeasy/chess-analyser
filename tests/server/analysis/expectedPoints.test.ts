import { test } from "node:test";
import assert from "node:assert/strict";
import { moverEp, epLoss } from "../../../src/server/analysis/expectedPoints.ts";

test("moverEp converts White-POV Win% to the mover's EP", () => {
  assert.equal(moverEp(70, "w"), 0.7);
  assert.equal(moverEp(70, "b"), 0.3);
});

test("epLoss is max(0, before - after), no tolerance", () => {
  assert.ok(Math.abs(epLoss(0.6, 0.4) - 0.2) < 1e-9);
  assert.equal(epLoss(0.4, 0.6), 0); // a gain is never a loss
  // stored raw, not rounded: binary floating point noise is kept, not hidden.
  assert.equal(epLoss(0.62, 0.6), 0.62 - 0.6);
  assert.ok(Math.abs(epLoss(0.62, 0.6) - 0.02) < 1e-9);
});
