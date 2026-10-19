// MetaInfo adapter. Uses MetaInfo's CI-oriented summary endpoint
// (`GET /api/report?url=&format=summary`, see metainfo app/api/report/route.ts)
// rather than re-implementing any SEO / AI-search checks here.

import type { MetaInfoSignals } from "@/lib/core/signals";
import { baseUrl, env, fail, ok, type AdapterInfo, type AdapterResult } from "./contract";

const TIMEOUT_MS = 45_000;

export function metainfoInfo(): AdapterInfo {
  const base = baseUrl("METAINFO_URL");
  return {
    id: "metainfo",
    name: "MetaInfo",
    description: "SEO and AI-search readiness: indexability, metadata, structured data, crawler access and a prioritised fix plan.",
    appUrl: base || null,
    configured: !!base,
    note: base ? "Discoverability checks run through MetaInfo's report API." : "Set METAINFO_URL to run discoverability checks through MetaInfo.",
    capabilities: { connect: "guided", discover: "unsupported", read: base ? "integrated" : "unsupported", execute: "guided", verify: base ? "integrated" : "unsupported" },
  };
}

interface SummaryResponse {
  url: string;
  scannedAt: string;
  summary: { overall: number; critical: number; failed: number; warnings: number; passed: number; total: number };
  scores: Record<string, number>;
  failing: { id: string; status: "fail" | "warn"; severity: string; title: string; finding: string }[];
}

/** Read: audit one URL. Also serves as Verify (re-scan after fixes). */
export async function metainfoReport(siteUrl: string): Promise<AdapterResult<MetaInfoSignals>> {
  const base = baseUrl("METAINFO_URL");
  if (!base) return fail("MetaInfo isn't connected. Set METAINFO_URL to include discoverability checks.");
  const headers: Record<string, string> = { accept: "application/json" };
  // MetaInfo's report endpoint is currently public; send a token once it accepts one.
  if (env("METAINFO_TOKEN")) headers.authorization = `Bearer ${env("METAINFO_TOKEN")}`;
  let res: Response;
  try {
    res = await fetch(`${base}/api/report?format=summary&url=${encodeURIComponent(siteUrl)}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return fail("MetaInfo didn't respond in time.", true);
  }
  const body = (await res.json().catch(() => null)) as (SummaryResponse & { error?: string }) | null;
  if (!res.ok || !body?.summary) return fail(`MetaInfo couldn't scan the site: ${body?.error ?? `HTTP ${res.status}`}`, res.status >= 500);
  return ok({
    url: body.url,
    scannedAt: body.scannedAt,
    overall: body.summary.overall,
    critical: body.summary.critical,
    scores: body.scores,
    failing: body.failing.slice(0, 40),
    reportUrl: `${base}/audit?url=${encodeURIComponent(body.url)}`,
  });
}
