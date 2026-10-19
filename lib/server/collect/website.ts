// Website evidence: status, final URL, security headers, homepage links and
// scripts. Page HTML is parsed in memory and never stored.

import type { SiteSignals } from "@/lib/core/signals";
import { extractPage } from "@/lib/core/urls";
import { fetchPublic } from "../safe-fetch";

const KEPT_HEADERS = ["strict-transport-security", "content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy", "server", "content-type"];

export async function collectWebsite(siteUrl: string): Promise<SiteSignals> {
  const res = await fetchPublic(siteUrl);
  const headers: Record<string, string> = {};
  for (const k of KEPT_HEADERS) {
    const v = res.headers.get(k);
    if (v) headers[k] = v.slice(0, 500);
  }
  const html = (headers["content-type"] ?? "").includes("html") || res.body.trimStart().startsWith("<") ? res.body : "";
  const page = extractPage(html, res.url);
  return { requestedUrl: siteUrl, finalUrl: res.url, status: res.status, headers, ...page };
}
