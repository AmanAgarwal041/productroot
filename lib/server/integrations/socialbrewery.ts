// SocialBrewery adapter, over its MCP connector (`POST /mcp`, JSON-RPC, Bearer
// connector token; see socialbrewery src/mcp.js). Connected per workspace: a
// connector token belongs to one SocialBrewery organisation, so a server-wide
// token would let every workspace post as that organisation.
//
// The connector token has the member role: it can post but cannot connect
// networks, so connecting LinkedIn/X/etc. stays a guided step in SocialBrewery.
// SocialBrewery publishes immediately and has no idempotency keys, so every
// consequential tool runs only from an approved workflow run, exactly once,
// and is never retried automatically.

import { fail, ok, type AdapterInfo, type AdapterResult, type DiscoverResult } from "./contract";

const TIMEOUT_MS = 20_000;
const POST_TIMEOUT_MS = 120_000;

export interface SocialBreweryConn {
  url: string;
  token: string;
}

export function socialbreweryInfo(conn: { url: string } | null): AdapterInfo {
  return {
    id: "socialbrewery",
    name: "SocialBrewery",
    description: "Drafts and publishes launch posts to YouTube Shorts, LinkedIn, Instagram, X, Hashnode, Slack and Reddit.",
    appUrl: conn?.url ?? null,
    configured: !!conn,
    note: conn
      ? "Connected through your organisation's MCP connector. Every post needs an approval in Workflows and runs exactly once."
      : "Connect with your SocialBrewery URL and the connector token from SocialBrewery → Connectors.",
    capabilities: { connect: "integrated", discover: conn ? "integrated" : "unsupported", read: conn ? "integrated" : "unsupported", execute: conn ? "integrated" : "unsupported", verify: "unsupported" },
  };
}

/** Tools that publish, change or delete content on a social network. */
export const isConsequential = (tool: string) => /^(post_|generate_and_post_|publish_|update_|delete_|comment_|reply_)/.test(tool);

export interface ToolDef {
  name: string;
  description: string;
  consequential: boolean;
  inputSchema: { properties?: Record<string, { type?: string; description?: string; enum?: string[] }>; required?: string[] };
}

async function rpc<T>(conn: SocialBreweryConn, method: string, params: unknown, timeout = TIMEOUT_MS): Promise<AdapterResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${conn.url.replace(/\/+$/, "")}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${conn.token}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    return fail(`SocialBrewery didn't respond within ${timeout / 1000}s.`, method !== "tools/call");
  }
  if (res.status === 401 || res.status === 403) return fail("SocialBrewery rejected the connector token. Rotate it in SocialBrewery → Connectors and reconnect.");
  const body = (await res.json().catch(() => null)) as { result?: T; error?: { message: string } } | null;
  if (!res.ok || !body || body.error || body.result === undefined) return fail(`SocialBrewery MCP error: ${body?.error?.message ?? `HTTP ${res.status}`}`, res.status >= 500 && method !== "tools/call");
  return ok(body.result);
}

export async function socialbreweryTools(conn: SocialBreweryConn): Promise<AdapterResult<ToolDef[]>> {
  const r = await rpc<{ tools?: { name: string; description?: string; inputSchema?: ToolDef["inputSchema"] }[] }>(conn, "tools/list", {});
  if (!r.ok) return r;
  if (!Array.isArray(r.data.tools)) return fail("SocialBrewery returned no tool list.");
  return ok(r.data.tools.map((t) => ({ name: t.name, description: (t.description ?? "").slice(0, 300), consequential: isConsequential(t.name), inputSchema: t.inputSchema ?? {} })));
}

export async function socialbreweryDiscover(conn: SocialBreweryConn): Promise<AdapterResult<DiscoverResult>> {
  const r = await socialbreweryTools(conn);
  return r.ok ? ok({ operations: r.data.map(({ name, description, consequential }) => ({ name, description, consequential })) }) : r;
}

/** Execute one tool. Called only from an approved workflow run. Never retried. */
export async function socialbreweryCall(conn: SocialBreweryConn, name: string, args: Record<string, unknown>): Promise<AdapterResult<string>> {
  const r = await rpc<{ content?: { type: string; text?: string }[]; isError?: boolean }>(conn, "tools/call", { name, arguments: args }, POST_TIMEOUT_MS);
  if (!r.ok) return r;
  const text = (r.data.content ?? []).map((c) => c.text ?? "").join("\n").slice(0, 4000);
  return r.data.isError ? fail(text || "The tool reported an error.") : ok(text);
}
