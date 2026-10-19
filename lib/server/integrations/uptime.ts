// Uptime monitoring adapters (UptimeRobot v3, Better Stack Uptime v2), used to
// *verify* the operations.uptime check: is there a monitor covering the
// production host, and is it up? Read-only API keys are enough.
// API shapes verified against the official docs on 2026-10-15:
// - UptimeRobot: GET https://api.uptimerobot.com/v3/monitors, Bearer key,
//   { data: [{ url, status }], nextLink }, status "UP" when up.
// - Better Stack: GET https://incidents.betterstack.com/api/v2/monitors, Bearer
//   token, { data: [{ attributes: { url, status } }], pagination: { next } }, "up".

import type { UptimeMonitor } from "@/lib/core/signals";
import type { ConnectionInfo } from "../connections";
import { fail, ok, type AdapterInfo, type AdapterResult } from "./contract";

const TIMEOUT_MS = 12_000;
const MAX_PAGES = 3;

export type UptimeProvider = "uptimerobot" | "betterstack";
export const UPTIME_NAME: Record<UptimeProvider, string> = { uptimerobot: "UptimeRobot", betterstack: "Better Stack" };

export function uptimeInfo(conn: ConnectionInfo | undefined): AdapterInfo {
  const name = conn ? UPTIME_NAME[conn.provider as UptimeProvider] : null;
  return {
    id: "uptime",
    name: name ?? "Uptime monitor",
    description: "Verifies that an uptime monitor covers your production site and reports it up. Connect UptimeRobot or Better Stack with a read-only key.",
    appUrl: conn ? (conn.provider === "uptimerobot" ? "https://dashboard.uptimerobot.com" : "https://uptime.betterstack.com") : null,
    configured: !!conn,
    note: conn ? `${name} is connected. Assessments check its monitors for your site.` : "Without a monitor connection, uptime can only be confirmed by you.",
    capabilities: { connect: "integrated", discover: conn ? "integrated" : "unsupported", read: conn ? "integrated" : "unsupported", execute: "unsupported", verify: conn ? "integrated" : "unsupported" },
  };
}

async function getJson(url: string, key: string): Promise<{ ok: true; body: unknown } | { ok: false; error: string; retryable: boolean }> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { authorization: `Bearer ${key}`, accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return { ok: false, error: "The monitoring service didn't respond in time.", retryable: true };
  }
  if (res.status === 401 || res.status === 403) return { ok: false, error: "The monitoring service rejected the API key.", retryable: false };
  if (!res.ok) return { ok: false, error: `The monitoring service returned HTTP ${res.status}.`, retryable: res.status >= 500 };
  return { ok: true, body: await res.json().catch(() => null) };
}

export async function listMonitors(provider: UptimeProvider, key: string): Promise<AdapterResult<UptimeMonitor[]>> {
  const monitors: UptimeMonitor[] = [];
  let url: string | null = provider === "uptimerobot" ? "https://api.uptimerobot.com/v3/monitors" : "https://incidents.betterstack.com/api/v2/monitors";
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const r = await getJson(url, key);
    if (!r.ok) return fail(r.error, r.retryable);
    if (provider === "uptimerobot") {
      const b = r.body as { data?: { url?: string; status?: string; friendlyName?: string }[]; nextLink?: string | null } | null;
      if (!Array.isArray(b?.data)) return fail("Unexpected response from UptimeRobot.");
      for (const m of b.data) if (m.url) monitors.push({ url: m.url, status: String(m.status ?? ""), up: String(m.status).toUpperCase() === "UP" });
      url = b.nextLink && b.nextLink.startsWith("https://api.uptimerobot.com/") ? b.nextLink : null;
    } else {
      const b = r.body as { data?: { attributes?: { url?: string; status?: string } }[]; pagination?: { next?: string | null } } | null;
      if (!Array.isArray(b?.data)) return fail("Unexpected response from Better Stack.");
      for (const m of b.data) if (m.attributes?.url) monitors.push({ url: m.attributes.url, status: String(m.attributes.status ?? ""), up: m.attributes.status === "up" });
      const next = b.pagination?.next;
      url = next && /^https:\/\/(incidents|uptime)\.betterstack\.com\//.test(next) ? next : null;
    }
  }
  return ok(monitors);
}

export const verifyUptimeKey = (provider: UptimeProvider, key: string) => listMonitors(provider, key);
