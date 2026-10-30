import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
const { server } = await import("../../src/server/index.ts");

test("GET /health answers ok", async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("expected a port");
  }
  const res = await fetch(`http://localhost:${address.port}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
  server.close();
});
