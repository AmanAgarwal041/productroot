import { describe, expect, it } from "vitest";
import { extractPage, normalizeSiteUrl, parseGithubRepo } from "@/lib/core/urls";
import { validateProjectInput } from "@/lib/core/project";
import { detectStack } from "@/lib/core/stack";
import { pickManifests } from "@/lib/server/collect/github";
import { isPrivateIp } from "@/lib/server/safe-fetch";
import { repo } from "./fixtures";

describe("parseGithubRepo", () => {
  it.each([
    ["https://github.com/AmanAgarwal041/metainfo", "AmanAgarwal041/metainfo"],
    ["github.com/a/b.git", "a/b"],
    ["https://github.com/a/b/tree/main/src", "a/b"],
    ["a/b", "a/b"],
  ])("%s", (input, expected) => {
    const r = parseGithubRepo(input)!;
    expect(`${r.owner}/${r.repo}`).toBe(expected);
  });

  it("rejects non-GitHub URLs", () => {
    expect(parseGithubRepo("https://gitlab.com/a/b")).toBeNull();
    expect(parseGithubRepo("a/..")).toBeNull();
  });
});

describe("normalizeSiteUrl", () => {
  it("adds https and drops the hash", () => expect(normalizeSiteUrl("acme.dev/#top")).toBe("https://acme.dev/"));
  it("rejects other schemes and credentials", () => {
    expect(normalizeSiteUrl("ftp://acme.dev")).toBeNull();
    expect(normalizeSiteUrl("https://u:p@acme.dev")).toBeNull();
    expect(normalizeSiteUrl("intranet")).toBeNull();
  });
});

describe("extractPage", () => {
  it("resolves links with text, aria-labels and scripts", () => {
    const html = `<title> Acme &amp; Co </title><a href="/pricing">Pricing</a><a href='mailto:hi@acme.dev'>Email</a>
      <a href="https://x.com/acme" aria-label="X"><svg/></a><a href="#top">Top</a><script src="/app.js"></script>
      <script>gtag('js'); src="https://www.googletagmanager.com/gtag/js?id=G-1"</script>`;
    const p = extractPage(html, "https://acme.dev/");
    expect(p.title).toBe("Acme & Co");
    expect(p.links).toEqual([
      { href: "https://acme.dev/pricing", text: "Pricing" },
      { href: "mailto:hi@acme.dev", text: "Email" },
      { href: "https://x.com/acme", text: "X" },
    ]);
    expect(p.scripts).toContain("https://acme.dev/app.js");
    expect(p.scripts.some((s) => s.includes("googletagmanager"))).toBe(true);
  });
});

describe("validateProjectInput", () => {
  const base = { repoUrl: "github.com/acme/app", productType: "saas", stage: "beta", monetization: "subscription" };
  it("normalises and names from the repo", () => {
    const v = validateProjectInput(base);
    expect(v).toMatchObject({ ok: true, value: { name: "app", repoUrl: "https://github.com/acme/app", siteUrl: null } });
  });
  it("requires a repo or a site", () => expect(validateProjectInput({ ...base, repoUrl: "" }).ok).toBe(false));
  it("rejects unknown enums", () => expect(validateProjectInput({ ...base, stage: "done" }).ok).toBe(false));
  it("merges partial updates", () => {
    const first = validateProjectInput(base);
    if (!first.ok) throw new Error(first.error);
    const current = first.value;
    const v = validateProjectInput({ stage: "launched" }, current);
    expect(v).toMatchObject({ ok: true, value: { stage: "launched", repoUrl: "https://github.com/acme/app" } });
  });
});

describe("detectStack", () => {
  it("detects a typical Next.js SaaS", () => {
    const s = detectStack(
      repo({
        files: ["package.json", "pnpm-lock.yaml", "tsconfig.json", "vercel.json", "prisma/schema.prisma"],
        deps: { next: "16", "@clerk/nextjs": "7", stripe: "18", "@prisma/client": "6" },
      }),
    );
    expect(s).toMatchObject({ languages: ["TypeScript"], frameworks: ["Next.js"], packageManager: "pnpm", hosting: ["Vercel"], databases: ["Prisma"], auth: ["Clerk"], billing: ["Stripe"], nonJs: false });
  });
  it("marks non-JS repositories", () => {
    expect(detectStack(repo({ files: ["go.mod"], manifests: [] }))).toMatchObject({ languages: ["Go"], nonJs: true });
  });
});

describe("helpers", () => {
  it("picks the shallowest manifests first", () => {
    expect(pickManifests(["apps/web/package.json", "package.json", "a/b/c/package.json", "README.md"])).toEqual(["package.json", "apps/web/package.json", "a/b/c/package.json"]);
  });
  it("recognises private addresses", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "192.168.1.1", "::1", "fd00::1", "::ffff:10.0.0.1"]) expect(isPrivateIp(ip), ip).toBe(true);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
  });
});
