// URL parsing and lightweight HTML extraction. No DOM on Workers, and we only
// need links, scripts and the title, so a tolerant regex pass is enough.

import type { LinkInfo } from "./signals";

/** `owner/repo` from a GitHub URL or shorthand, or null. */
export function parseGithubRepo(input: string): { owner: string; repo: string } | null {
  const s = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const m =
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})(?:\/.*)?$/i.exec(s) ??
    /^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/.exec(s);
  if (!m || m[2] === "." || m[2] === "..") return null;
  return { owner: m[1], repo: m[2] };
}

/** Normalise a user-entered website to an absolute http(s) URL, or null. */
export function normalizeSiteUrl(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");

const attr = (tag: string, name: string) => {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? "") : null;
};

export interface ExtractedPage {
  title: string | null;
  links: LinkInfo[];
  scripts: string[];
}

/** Title, resolved links (with visible text / aria-label) and script srcs. */
export function extractPage(html: string, baseUrl: string, maxLinks = 300): ExtractedPage {
  const resolve = (href: string) => {
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return null;
    }
  };
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];

  const links: LinkInfo[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const raw = attr(m[1], "href");
    if (!raw || raw.startsWith("#") || /^javascript:/i.test(raw)) continue;
    const href = raw.startsWith("mailto:") ? raw : resolve(raw);
    if (!href) continue;
    const text = decode(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() || attr(m[1], "aria-label") || attr(m[1], "title") || "";
    const key = `${href}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ href, text: text.slice(0, 120) });
    if (links.length >= maxLinks) break;
  }

  const scripts: string[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    const src = attr(m[1], "src");
    const abs = src && resolve(src);
    if (abs && scripts.length < 100) scripts.push(abs);
  }
  // Inline snippets of common analytics tools load their script from a known host.
  for (const host of html.matchAll(/https:\/\/[a-z0-9.-]*(googletagmanager\.com|plausible\.io|posthog\.com|usefathom\.com|clarity\.ms|cloudflareinsights\.com)[^"'\s)]*/gi)) {
    if (scripts.length < 100 && !scripts.includes(host[0])) scripts.push(host[0]);
  }

  return { title: title ? decode(title).replace(/\s+/g, " ").trim().slice(0, 200) || null : null, links, scripts };
}
