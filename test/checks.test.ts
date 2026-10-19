import { describe, expect, it } from "vitest";
import { CHECK_BY_ID, CHECKS, evaluateAll } from "@/lib/core/checks";
import { ctx, repo, signals, site } from "./fixtures";

const run = (id: string, s = signals()) => CHECK_BY_ID[id].evaluate(s);

describe("catalog integrity", () => {
  it("has unique ids and valid dependencies", () => {
    const ids = CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CHECKS) for (const d of c.dependsOn ?? []) expect(CHECK_BY_ID[d], `${c.id} -> ${d}`).toBeDefined();
  });

  it("never reports missing or verified with no sources at all", () => {
    for (const r of evaluateAll(signals())) expect(["needs_confirmation"]).toContain(r.state);
  });
});

describe("auth.present (Journey C: existing auth)", () => {
  it("detects a known provider from dependencies", () => {
    const r = run("auth.present", signals({ repo: repo({ deps: { "@clerk/nextjs": "^7" } }) }));
    expect(r.state).toBe("detected");
    expect(r.summary).toContain("Clerk");
    expect(r.evidence[0]).toMatchObject({ source: "github", ref: "@clerk/nextjs" });
  });

  it("asks for confirmation on custom sign-in routes instead of assuming", () => {
    const r = run("auth.present", signals({ repo: repo({ files: ["app/login/page.tsx"] }) }));
    expect(r.state).toBe("needs_confirmation");
    expect(r.evidence.map((e) => e.ref)).toContain("app/login/page.tsx");
  });

  it("does not call auth missing just because nothing was found", () => {
    expect(run("auth.present", signals({ repo: repo() })).state).toBe("needs_confirmation");
  });

  it("treats managed providers as covering recovery flows", () => {
    expect(run("auth.recovery", signals({ repo: repo({ deps: { "@clerk/nextjs": "^7" } }) })).state).toBe("detected");
  });
});

describe("presence checks", () => {
  it("reports missing CI only when the full tree was read", () => {
    expect(run("quality.ci", signals({ repo: repo() })).state).toBe("missing");
    expect(run("quality.ci", signals({ repo: repo({ truncated: true }) })).state).toBe("needs_confirmation");
    expect(run("quality.ci", signals({ repo: repo({ files: [".github/workflows/ci.yml"] }) })).state).toBe("detected");
  });

  it("uses GitHub's license metadata", () => {
    expect(run("oss.license", signals({ repo: repo({ license: "MIT" }) })).summary).toContain("MIT");
  });
});

describe("security.secrets", () => {
  it("flags committed env files and keys but not examples or fixtures", () => {
    const r = run("security.secrets", signals({ repo: repo({ files: [".env", ".env.example", "certs/server.key", "test/fixtures/fake.pem", "keys/id_rsa.pub"] }) }));
    expect(r.state).toBe("missing");
    expect(r.evidence.map((e) => e.ref).sort()).toEqual([".env", "certs/server.key"]);
  });

  it("passes a clean tree", () => {
    expect(run("security.secrets", signals({ repo: repo({ files: [".env.example", "src/index.ts"] }) })).state).toBe("detected");
  });
});

describe("website checks", () => {
  it("verifies reachability and HTTPS from the live response", () => {
    const s = signals({ site: site() });
    expect(run("site.reachable", s).state).toBe("verified");
    expect(run("site.https", s).state).toBe("verified");
    expect(run("site.https", signals({ site: site({ finalUrl: "http://acme.dev/" }) })).state).toBe("missing");
  });

  it("reports unreachable sites with the error", () => {
    const r = run("site.reachable", signals({ siteError: "Timed out after 12s." }));
    expect(r.state).toBe("missing");
    expect(r.summary).toContain("Timed out");
  });

  it("lists which security headers are absent", () => {
    const r = run("security.headers", signals({ site: site({ headers: { "strict-transport-security": "max-age=1", "x-content-type-options": "nosniff" } }) }));
    expect(r.state).toBe("missing");
    expect(r.summary).toContain("2 of 5");
    expect(r.summary).toContain("Content-Security-Policy");
  });

  it("accepts CSP frame-ancestors as frame protection", () => {
    const headers = {
      "strict-transport-security": "max-age=1",
      "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    };
    expect(run("security.headers", signals({ site: site({ headers }) })).state).toBe("verified");
  });

  it("finds privacy links, and calls them missing only after reading the homepage", () => {
    expect(run("legal.privacy", signals({ site: site({ links: [{ href: "https://acme.dev/legal/privacy", text: "Privacy" }] }) })).state).toBe("detected");
    expect(run("legal.privacy", signals({ site: site({ links: [{ href: "https://acme.dev/blog", text: "Blog" }] }) })).state).toBe("missing");
    expect(run("legal.privacy", signals({ repo: repo() })).state).toBe("needs_confirmation");
  });
});

describe("growth.discoverability (MetaInfo)", () => {
  const meta = (overall: number, critical = 0) => ({
    url: "https://acme.dev/",
    scannedAt: "2026-10-15T00:00:00Z",
    overall,
    critical,
    scores: { google: overall },
    failing: Array.from({ length: critical }, (_, i) => ({ id: `c${i}`, status: "fail" as const, severity: "critical", title: `Critical ${i}`, finding: "" })),
    reportUrl: "https://metainfo.example/audit?url=x",
  });

  it("verifies a good score with no critical failures", () => {
    expect(run("growth.discoverability", signals({ metainfo: meta(85) })).state).toBe("verified");
  });

  it("flags critical failures even with a good score", () => {
    const r = run("growth.discoverability", signals({ metainfo: meta(90, 2) }));
    expect(r.state).toBe("missing");
    expect(r.evidence.filter((e) => e.source === "metainfo")).toHaveLength(3);
  });

  it("surfaces why MetaInfo is unavailable", () => {
    expect(run("growth.discoverability", signals({ metainfoError: "MetaInfo isn't connected." })).summary).toContain("isn't connected");
  });
});

describe("priorities follow context", () => {
  it("makes billing a blocker only for paid products", () => {
    expect(CHECK_BY_ID["billing.provider"].priority(ctx({ monetization: "subscription" }))).toBe("blocker");
    expect(CHECK_BY_ID["billing.provider"].priority(ctx({ monetization: "undecided" }))).toBe("optional");
    expect(CHECK_BY_ID["billing.provider"].priority(ctx({ monetization: "free" }))).toBeNull();
  });

  it("Journey B: open source skips the subscription stack and requires a license", () => {
    const oss = ctx({ productType: "oss", monetization: "free" });
    expect(CHECK_BY_ID["billing.webhooks"].priority(oss)).toBeNull();
    expect(CHECK_BY_ID["auth.present"].priority(oss)).toBeNull();
    expect(CHECK_BY_ID["oss.license"].priority(oss)).toBe("blocker");
    expect(CHECK_BY_ID["oss.license"].priority(ctx())).toBeNull();
  });
});

describe("billing.webhooks", () => {
  it("ignores non-payment webhooks", () => {
    expect(run("billing.webhooks", signals({ repo: repo({ files: ["src/instagram-webhooks.js"] }) })).state).toBe("needs_confirmation");
  });
  it("detects payment webhook handlers", () => {
    expect(run("billing.webhooks", signals({ repo: repo({ files: ["app/api/webhooks/stripe/route.ts"] }) })).state).toBe("detected");
    expect(run("billing.webhooks", signals({ repo: repo({ files: ["src/billing/webhook.ts"] }) })).state).toBe("detected");
  });
});
