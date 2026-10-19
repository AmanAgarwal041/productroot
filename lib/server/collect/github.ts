// Repository evidence from GitHub's REST API: metadata, the full file tree
// (one request), and up to a handful of package.json manifests. Uses the
// workspace's GitHub connection when there is one (private repositories),
// otherwise the server's GITHUB_TOKEN or anonymous access (public only).
// Read-only; file contents other than package.json are never fetched.

import type { RepoSignals } from "@/lib/core/signals";

export class GithubError extends Error {
  constructor(message: string, public retryable = false, public status = 0) {
    super(message);
  }
}

const API = "https://api.github.com";
const TIMEOUT_MS = 12_000;
const MAX_MANIFESTS = 6;
const VENDOR = /(^|\/)(node_modules|vendor|\.git|dist|build|\.next|\.turbo|coverage|target|\.venv|__pycache__)\//;

export async function gh<T>(path: string, token: string | null, init: { method?: string; body?: unknown; accept?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: init.accept ?? "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "ProductRoot" };
  const auth = token ?? (process.env.GITHUB_TOKEN?.trim() || null);
  if (auth) headers.authorization = `Bearer ${auth}`;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new GithubError("GitHub didn't respond in time.", true);
  }
  if (res.status === 401) throw new GithubError("GitHub rejected the token. Reconnect GitHub in Integrations.");
  if (res.status === 404)
    throw new GithubError(token ? "Not found, or the GitHub token can't access this repository. Check the token's repository access." : "Repository not found. For private repositories, connect GitHub in Integrations.", false, 404);
  if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const when = reset ? ` Try again after ${new Date(reset * 1000).toISOString().slice(11, 16)} UTC.` : "";
    throw new GithubError(`GitHub rate limit reached.${when}`, true);
  }
  if (res.status === 403) throw new GithubError("The GitHub token doesn't have permission for this. Check its repository permissions.", false, 403);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new GithubError(`GitHub returned HTTP ${res.status}${body?.message ? `: ${body.message}` : ""}.`, res.status >= 500, res.status);
  }
  if (init.accept?.includes("raw")) return (await res.text()) as T;
  return (await res.json()) as T;
}

async function raw(owner: string, repo: string, ref: string, path: string, token: string | null): Promise<string | null> {
  if (token) {
    // Private repositories: raw.githubusercontent.com needs auth, so use the contents API.
    return gh<string>(`/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`, token, { accept: "application/vnd.github.raw+json" })
      .then((t) => (t.length > 512 * 1024 ? null : t))
      .catch(() => null);
  }
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${path.split("/").map(encodeURIComponent).join("/")}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > 512 * 1024 ? null : text;
  } catch {
    return null;
  }
}

/** Which package.json files to read: the root first, then the shallowest workspace manifests. */
export function pickManifests(files: string[]): string[] {
  return files
    .filter((f) => /(^|\/)package\.json$/.test(f))
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))
    .slice(0, MAX_MANIFESTS);
}

export async function collectGithub(owner: string, repo: string, token: string | null = null): Promise<RepoSignals> {
  const meta = await gh<{ default_branch: string; private: boolean; license: { spdx_id: string | null; name: string } | null; full_name: string }>(`/repos/${owner}/${repo}`, token);
  const [canonOwner, canonRepo] = meta.full_name.split("/");
  const tree = await gh<{ tree: { path: string; type: string }[]; truncated: boolean }>(
    `/repos/${canonOwner}/${canonRepo}/git/trees/${encodeURIComponent(meta.default_branch)}?recursive=1`,
    token,
  );
  const files = tree.tree.filter((t) => t.type === "blob" && !VENDOR.test(t.path)).map((t) => t.path);

  const manifests = pickManifests(files);
  const deps: Record<string, string> = {};
  const scripts: Record<string, string> = {};
  const read: string[] = [];
  await Promise.all(
    manifests.map(async (path) => {
      const text = await raw(canonOwner, canonRepo, meta.default_branch, path, token);
      if (!text) return;
      try {
        const pkg = JSON.parse(text) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string> };
        for (const [k, v] of Object.entries({ ...pkg.devDependencies, ...pkg.dependencies })) if (typeof v === "string") deps[k] ??= v;
        if (path === "package.json" && pkg.scripts) for (const [k, v] of Object.entries(pkg.scripts)) if (typeof v === "string") scripts[k] = v.slice(0, 200);
        read.push(path);
      } catch {
        /* not JSON; skip */
      }
    }),
  );

  const spdx = meta.license?.spdx_id;
  return {
    owner: canonOwner,
    repo: canonRepo,
    branch: meta.default_branch,
    files,
    truncated: tree.truncated,
    deps,
    scripts,
    private: meta.private,
    manifests: read.sort(),
    license: spdx && spdx !== "NOASSERTION" ? spdx : (meta.license?.name ?? null),
  };
}
