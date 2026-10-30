import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

/**
 * Serves the built single-page app from `root`. Any path that is not a real
 * file falls back to index.html (client-side routing); paths are resolved
 * relative to `root` so they can never escape it.
 */
export async function serveStatic(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url || "/", "http://localhost");
  const requested = join(root, url.pathname);
  const safe = requested.startsWith(join(root)) ? requested : root;

  const candidate = safe.endsWith("/") ? join(safe, "index.html") : safe;
  const file = await readFile(candidate).catch(() => readFile(join(root, "index.html")).catch(() => null));

  if (file === null) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": contentTypes[extname(candidate)] || "application/octet-stream" });
  res.end(file);
}
