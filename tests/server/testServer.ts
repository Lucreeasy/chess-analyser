import type { Server } from "node:http";

/** Starts `server` on an ephemeral port, runs `run` against it, and always closes it again. */
export async function withServer<T>(server: Server, run: (baseUrl: string) => Promise<T>): Promise<T> {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("expected a port");
  try {
    return await run(`http://localhost:${address.port}`);
  } finally {
    server.close();
  }
}

/** Polls `predicate` until it is true, or rejects after `timeoutMs`. */
export function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = async () => {
      if (await predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("timed out waiting"));
      setTimeout(check, 10);
    };
    check();
  });
}
