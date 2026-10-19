import { afterEach, describe, expect, it, vi } from "vitest";
import { openPullRequest } from "@/lib/server/github-pr";
import { open, seal } from "@/lib/server/secrets";

describe("credential encryption", () => {
  it("round-trips and is bound to its workspace/provider", async () => {
    const sealed = await seal("ghp_secret", "productroot:org_1:github");
    expect(sealed).not.toContain("ghp_secret");
    expect(await open(sealed, "productroot:org_1:github")).toBe("ghp_secret");
    await expect(open(sealed, "productroot:org_2:github")).rejects.toThrow();
  });
});

type Route = { method: string; match: RegExp; reply: (body: unknown) => [number, unknown] };

function mockGithub(routes: Route[]) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    const r = routes.find((x) => x.method === method && x.match.test(url));
    if (!r) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    const [status, json] = r.reply(body);
    return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
  });
  return calls;
}

const repoMeta: Route = { method: "GET", match: /\/repos\/acme\/app$/, reply: () => [200, { default_branch: "main", full_name: "acme/app" }] };
const noPulls: Route = { method: "GET", match: /\/pulls\?state=all/, reply: () => [200, []] };
const tree = (paths: string[]): Route => ({ method: "GET", match: /\/git\/trees\/main\?recursive=1/, reply: () => [200, { tree: paths.map((path) => ({ path })) }] });
const opts = { branch: "productroot/abc", title: "Add CI", body: "b", files: [{ path: ".github/workflows/ci.yml", content: "x" }] };

afterEach(() => vi.unstubAllGlobals());

describe("openPullRequest", () => {
  it("creates a branch from the default branch and opens a PR", async () => {
    const calls = mockGithub([
      repoMeta,
      noPulls,
      tree(["README.md"]),
      { method: "GET", match: /\/git\/ref\/heads\/main$/, reply: () => [200, { object: { sha: "base" } }] },
      { method: "GET", match: /\/git\/commits\/base$/, reply: () => [200, { tree: { sha: "t0" } }] },
      { method: "POST", match: /\/git\/trees$/, reply: () => [201, { sha: "t1" }] },
      { method: "POST", match: /\/git\/commits$/, reply: () => [201, { sha: "c1" }] },
      { method: "POST", match: /\/git\/refs$/, reply: () => [201, {}] },
      { method: "POST", match: /\/pulls$/, reply: () => [201, { number: 7, html_url: "https://github.com/acme/app/pull/7", state: "open", merged_at: null, head: { ref: "productroot/abc" } }] },
    ]);
    const pr = await openPullRequest("tok", "acme", "app", opts);
    expect(pr).toEqual({ number: 7, url: "https://github.com/acme/app/pull/7", branch: "productroot/abc", state: "open" });
    const writes = calls.filter((c) => c.method === "POST");
    expect(writes.find((c) => c.url.endsWith("/git/refs"))?.body).toEqual({ ref: "refs/heads/productroot/abc", sha: "c1" });
    expect(writes.find((c) => c.url.endsWith("/pulls"))?.body).toMatchObject({ base: "main", head: "productroot/abc" });
    // Never writes to the default branch ref.
    expect(calls.some((c) => c.method !== "GET" && /heads\/main/.test(c.url))).toBe(false);
  });

  it("refuses to overwrite existing files", async () => {
    mockGithub([repoMeta, noPulls, tree([".github/workflows/ci.yml"])]);
    await expect(openPullRequest("tok", "acme", "app", opts)).rejects.toThrow(/won't be overwritten/);
  });

  it("is idempotent: an existing PR for the branch is returned without new writes", async () => {
    const calls = mockGithub([
      repoMeta,
      { method: "GET", match: /\/pulls\?state=all/, reply: () => [200, [{ number: 7, html_url: "u", state: "closed", merged_at: "2026-10-15T00:00:00Z", head: { ref: "productroot/abc" } }]] },
    ]);
    expect((await openPullRequest("tok", "acme", "app", opts)).state).toBe("merged");
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("resumes a half-finished run: branch exists, PR missing", async () => {
    const calls = mockGithub([
      repoMeta,
      noPulls,
      { method: "GET", match: /\/git\/ref\/heads\/productroot%2Fabc$/, reply: () => [200, { object: { sha: "c1" } }] },
      { method: "POST", match: /\/pulls$/, reply: () => [201, { number: 8, html_url: "u", state: "open", merged_at: null, head: { ref: "productroot/abc" } }] },
    ]);
    expect((await openPullRequest("tok", "acme", "app", opts)).number).toBe(8);
    expect(calls.filter((c) => c.method === "POST").map((c) => c.url.split("/").pop())).toEqual(["pulls"]);
  });
});
