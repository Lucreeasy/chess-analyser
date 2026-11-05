/**
 * The server fetch wrapper. Relative URLs only (CLAUDE.md), so the app
 * keeps working when served under a URL path prefix. docs/06-GAMES-SPEC.md:
 * "when the server cannot be reached at all" gets a fixed message.
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`api/${path}`, init);
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.");
  }
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    const message = body && typeof body === "object" && "error" in body ? String(body.error) : `server answered ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** For endpoints that read a raw text body instead of JSON (games/import). */
export function apiPostText<T>(path: string, text: string): Promise<T> {
  return request<T>(path, { method: "POST", body: text });
}
