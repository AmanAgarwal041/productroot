"use client";

// Browser → API calls. Same-origin, so Clerk's __session cookie goes along;
// when Clerk is loaded we also send a freshly minted token as a Bearer header,
// because the cookie can lag behind for up to a minute.

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type ClerkWindow = { Clerk?: { session?: { getToken?: () => Promise<string | null> } | null } };

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["content-type"] = "application/json";
  const token = await (window as unknown as ClerkWindow).Clerk?.session?.getToken?.().catch(() => null);
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(path, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body), cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (HTTP ${res.status}).`, res.status);
  return body as T;
}
