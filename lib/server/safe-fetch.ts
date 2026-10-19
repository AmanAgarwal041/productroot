// Fetching user-supplied URLs safely. Same SSRF guard as MetaInfo
// (lib/server/fetch-bundle.ts there): on Workers, `global_fetch_strictly_public`
// blocks private networks and only literal IPs need checking; under `next dev`
// hostnames are resolved and private addresses refused. Redirects are followed
// by hand so every hop is re-checked.

export class FetchError extends Error {}

const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 5;

function ipVersion(s: string): 0 | 4 | 6 {
  if (/^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(s)) return 4;
  if (s.includes(":") && /^[0-9a-f:.]+$/i.test(s)) return 6;
  return 0;
}

export function isPrivateIp(ip: string): boolean {
  if (ipVersion(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const l = ip.toLowerCase();
  if (l.startsWith("::ffff:")) return isPrivateIp(l.slice(7));
  return l === "::" || l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80");
}

const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

export async function assertPublic(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchError(`Only http(s) URLs are allowed (got ${url.protocol}).`);
  if (url.port && url.port !== "80" && url.port !== "443") throw new FetchError("Only the default http/https ports are allowed.");
  if (process.env.ALLOW_PRIVATE_HOSTS === "1") return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new FetchError("That host is on a private network and can't be checked.");
  }
  if (onWorkers && !ipVersion(host)) return;
  const addrs = ipVersion(host)
    ? [{ address: host }]
    : await (await import("node:dns/promises")).default.lookup(host, { all: true }).catch(() => {
        throw new FetchError(`Could not resolve ${host}.`);
      });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new FetchError("That host is on a private network and can't be checked.");
}

async function readCapped(res: Response, max: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < max) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const out = new Uint8Array(Math.min(total, max));
  let off = 0;
  for (const c of chunks) {
    const take = Math.min(c.byteLength, out.length - off);
    out.set(c.subarray(0, take), off);
    off += take;
    if (off >= out.length) break;
  }
  return new TextDecoder().decode(out);
}

export interface PublicResponse {
  url: string;
  status: number;
  headers: Headers;
  body: string;
}

/** GET a public URL, following redirects with the SSRF check on every hop. Body is capped at `maxBytes`. */
export async function fetchPublic(input: string, { maxBytes = 2 * 1024 * 1024, headers = {} as Record<string, string> } = {}): Promise<PublicResponse> {
  let url = new URL(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    let res: Response;
    try {
      res = await fetch(url, { redirect: "manual", headers: { "user-agent": "ProductRootBot/0.1 (+launch readiness check)", accept: "text/html,*/*;q=0.8", ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      throw new FetchError(e instanceof Error && e.name === "TimeoutError" ? `Timed out after ${TIMEOUT_MS / 1000}s.` : `Request failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => {});
      url = new URL(location, url);
      continue;
    }
    return { url: url.toString(), status: res.status, headers: res.headers, body: await readCapped(res, maxBytes) };
  }
  throw new FetchError(`More than ${MAX_REDIRECTS} redirects.`);
}
