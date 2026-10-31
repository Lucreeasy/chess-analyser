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
