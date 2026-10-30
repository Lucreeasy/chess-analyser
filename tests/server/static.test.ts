import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { serveStatic } from "../../src/server/static.ts";

function makeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "static-test-"));
  writeFileSync(join(root, "index.html"), "<html>home</html>");
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "assets", "app.js"), "console.log(1)");
  return root;
}

async function withServedFile(
  root: string,
  path: string,
): Promise<{ status: number; body: string; contentType: string | undefined }> {
  const server = createServer((req, res) => void serveStatic(root, req, res));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("expected a port");
  try {
    const res = await fetch(`http://localhost:${address.port}${path}`);
    return { status: res.status, body: await res.text(), contentType: res.headers.get("content-type") ?? undefined };
  } finally {
    server.close();
  }
}

test("serves a real file with its content type", async () => {
  const root = makeFixture();
  const result = await withServedFile(root, "/assets/app.js");
  assert.equal(result.status, 200);
  assert.equal(result.body, "console.log(1)");
  assert.match(result.contentType ?? "", /javascript/);
});

test("falls back to index.html for an unknown path (client-side routing)", async () => {
  const root = makeFixture();
  const result = await withServedFile(root, "/games/some-id");
  assert.equal(result.status, 200);
  assert.equal(result.body, "<html>home</html>");
});

test("cannot escape the root with a path-traversal request", async () => {
  const root = makeFixture();
  const result = await withServedFile(root, "/../../etc/passwd");
  assert.equal(result.status, 200);
  assert.equal(result.body, "<html>home</html>"); // falls back, never leaves root
});
