// The shared integration contract (plan §5): connect, discover, read, execute,
// verify, report. Not every provider supports every step, and each adapter
// declares honestly how deep its support goes.

export type Capability = "connect" | "discover" | "read" | "execute" | "verify";

/**
 * - integrated: ProductRoot does it through the provider's API.
 * - guided: ProductRoot links or explains; the user does it in the provider.
 * - unsupported: not possible yet.
 */
export type Support = "integrated" | "guided" | "unsupported";

export interface AdapterInfo {
  id: string;
  name: string;
  description: string;
  /** Where the user goes for guided steps. */
  appUrl: string | null;
  configured: boolean;
  /** Why it isn't configured, or what the configuration means. */
  note: string;
  capabilities: Record<Capability, Support>;
}

export interface DiscoverResult {
  /** Operations the provider exposes right now (e.g. MCP tool names). */
  operations: { name: string; description: string; consequential: boolean }[];
}

/** Normalised result of any adapter call ("report" in the plan's contract). */
export type AdapterResult<T> =
  | { ok: true; data: T; at: string }
  | { ok: false; error: string; retryable: boolean; at: string };

export const ok = <T>(data: T): AdapterResult<T> => ({ ok: true, data, at: new Date().toISOString() });
export const fail = <T>(error: string, retryable = false): AdapterResult<T> => ({ ok: false, error, retryable, at: new Date().toISOString() });

export const env = (k: string) => process.env[k]?.trim() || "";
export const baseUrl = (k: string) => env(k).replace(/\/+$/, "");
