import { describe, expect, it } from "vitest";
import { compareProviders, fitProvider, type ProviderOption } from "@/lib/core/catalog";
import { CATALOG } from "@/lib/core/catalog-data";
import { CHECK_BY_ID } from "@/lib/core/checks";
import { generate, GENERATORS, type GenContext } from "@/lib/core/generators";
import { buildLaunchGraph, phaseOf } from "@/lib/core/launch-map";
import { buildPlan, readiness } from "@/lib/core/plan";
import { findRegressions } from "@/lib/core/regressions";
import { samplePlan } from "@/lib/core/sample";
import type { CheckResult } from "@/lib/core/types";
import { stableHash, transition } from "@/lib/core/workflow";
import { ctx, signals, site } from "./fixtures";

const provider = (over: Partial<ProviderOption> = {}): ProviderOption => ({
  id: "p",
  name: "Pay",
  capability: "payments",
  summary: "",
  website: "https://pay.example",
  pricingModel: "",
  freeTier: null,
  fees: null,
  merchantOfRecord: false,
  sellerCountries: ["US"],
  businessTypes: ["company"],
  frameworks: [],
  setup: "hours",
  prerequisites: [],
  limitations: [],
  sources: [{ label: "Docs", url: "https://pay.example/docs" }],
  verifiedAt: "2026-10-15",
  integration: "guided",
  ...over,
});
const today = new Date("2026-10-20T00:00:00Z");
const fitCtx = { country: "US", businessType: "company" as const, monetization: "subscription" as const, frameworks: ["Next.js"], detected: [] };

describe("catalog data", () => {
  it("has a source and a valid date for every provider, and unique ids", () => {
    expect(new Set(CATALOG.map((p) => p.id)).size).toBe(CATALOG.length);
    for (const p of CATALOG) {
      expect(p.sources.length, p.id).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(p.verifiedAt)), p.id).toBe(false);
      for (const s of p.sources) expect(s.url, p.id).toMatch(/^https:\/\//);
    }
  });
});

describe("provider eligibility", () => {
  it("never guesses: unknown facts make eligibility unknown", () => {
    const f = fitProvider(provider({ sellerCountries: null }), fitCtx, today);
    expect(f.eligibility).toBe("unknown");
    expect(f.reasons.some((r) => /isn't confirmed/.test(r.text))).toBe(true);
  });

  it("asks for the country before judging", () => {
    expect(fitProvider(provider(), { ...fitCtx, country: null }, today).eligibility).toBe("unknown");
  });

  it("rules out unsupported countries and business types, and ranks them last", () => {
    expect(fitProvider(provider(), { ...fitCtx, country: "IN" }, today).eligibility).toBe("ineligible");
    expect(fitProvider(provider(), { ...fitCtx, businessType: "individual" }, today).eligibility).toBe("ineligible");
    const ranked = compareProviders([provider({ id: "a", name: "A", sellerCountries: ["IN"] }), provider({ id: "b", name: "B", setup: "days" })], "payments", fitCtx, today);
    expect(ranked.map((r) => r.provider.id)).toEqual(["b", "a"]);
  });

  it("prefers what's already in the code over switching", () => {
    const ranked = compareProviders([provider({ id: "new", name: "New", merchantOfRecord: true, setup: "minutes" }), provider({ id: "old", name: "Old", detectAs: ["Old"] })], "payments", { ...fitCtx, detected: ["Old"] }, today);
    expect(ranked[0].provider.id).toBe("old");
    expect(ranked[0].inUse).toBe(true);
  });

  it("flags stale facts", () => {
    expect(fitProvider(provider({ verifiedAt: "2026-01-01" }), fitCtx, today).stale).toBe(true);
    expect(fitProvider(provider(), fitCtx, today).stale).toBe(false);
  });

  it("filters real catalog data by country (Razorpay is not for German sellers)", () => {
    const fits = compareProviders(CATALOG, "payments", { ...fitCtx, country: "DE" }, today);
    const razorpay = fits.find((f) => f.provider.id === "razorpay");
    expect(razorpay?.eligibility).toBe("ineligible");
    expect(fits.at(-1)?.eligibility).toBe("ineligible");
  });
});

describe("generators", () => {
  const g: GenContext = { owner: "acme", repo: "app", productName: "Acme", siteUrl: null, packageManager: "pnpm", scripts: ["lint", "test", "build", "dev"], js: true };

  it("builds a CI workflow from the scripts that exist", () => {
    const r = generate(g, ["quality.ci"], {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const yml = r.files[0].content;
    expect(r.files[0].path).toBe(".github/workflows/ci.yml");
    expect(yml).toContain("pnpm/action-setup");
    expect(yml).toContain("pnpm install --frozen-lockfile");
    expect(yml).toContain("pnpm lint");
    expect(yml).not.toContain("typecheck");
  });

  it("refuses CI without scripts or for non-JS repos", () => {
    expect(generate({ ...g, scripts: [] }, ["quality.ci"], {}).ok).toBe(false);
    expect(generate({ ...g, js: false }, ["quality.ci"], {}).ok).toBe(false);
  });

  it("validates parameters", () => {
    expect(generate(g, ["oss.security_policy"], { "oss.security_policy": { contact: "not-an-email" } }).ok).toBe(false);
    expect(generate(g, ["oss.license"], { "oss.license": { holder: "Acme\n<script>" } }).ok).toBe(false);
    const ok = generate(g, ["oss.license", "oss.security_policy"], { "oss.license": { holder: "Acme Ltd" } });
    expect(ok.ok && ok.files.map((f) => f.path)).toEqual(["LICENSE", "SECURITY.md"]);
  });

  it("only generates for real checks, and never legal documents", () => {
    for (const gen of GENERATORS) expect(CHECK_BY_ID[gen.checkId]).toBeDefined();
    expect(GENERATORS.some((x) => x.checkId.startsWith("legal."))).toBe(false);
  });
});

describe("workflow transitions", () => {
  const admin = { userId: "a", role: "admin" as const };
  const member = { userId: "m", role: "member" as const };
  const pr = { kind: "github.pull_request" as const, status: "pending_approval" as const, requestedBy: "m" };
  const post = { ...pr, kind: "socialbrewery.post" as const };

  it("requires an admin to approve", () => {
    expect(transition(pr, "approve", member)).toMatchObject({ ok: false, status: 403 });
    expect(transition(pr, "approve", admin)).toEqual({ ok: true, from: "pending_approval", to: "running" });
  });

  it("lets the requester cancel their own proposal", () => {
    expect(transition(pr, "cancel", member)).toMatchObject({ ok: true, to: "cancelled" });
    expect(transition(pr, "cancel", { userId: "other", role: "member" })).toMatchObject({ ok: false });
  });

  it("never approves twice", () => {
    expect(transition({ ...pr, status: "running" }, "approve", admin)).toMatchObject({ ok: false, status: 409 });
  });

  it("retries idempotent PRs but never social posts", () => {
    expect(transition({ ...pr, status: "failed" }, "retry", admin)).toMatchObject({ ok: true, to: "running" });
    expect(transition({ ...post, status: "failed" }, "retry", admin)).toMatchObject({ ok: false, status: 409 });
  });

  it("hashes stably regardless of key order", () => {
    expect(stableHash({ a: 1, b: [1, 2] })).toBe(stableHash({ b: [1, 2], a: 1 }));
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
  });
});

describe("regressions", () => {
  const r = (id: string, state: CheckResult["state"]): CheckResult => ({ id, state, summary: "s", evidence: [] });
  it("reports only checks that went from passing to missing", () => {
    const prev = [r("security.headers", "verified"), r("quality.ci", "missing"), r("auth.present", "detected")];
    const next = [r("security.headers", "missing"), r("quality.ci", "missing"), r("auth.present", "needs_confirmation")];
    expect(findRegressions(prev, next).map((x) => x.checkId)).toEqual(["security.headers"]);
    expect(findRegressions(null, next)).toEqual([]);
  });
});

describe("uptime verification", () => {
  const up = (monitors: { url: string; status: string; up: boolean }[]) => CHECK_BY_ID["operations.uptime"].evaluate(signals({ site: site(), uptime: { provider: "UptimeRobot", monitors } }));
  it("verifies a monitor that covers the site and is up", () => {
    expect(up([{ url: "https://www.acme.dev/health", status: "UP", up: true }]).state).toBe("verified");
  });
  it("flags a down monitor or a missing one", () => {
    expect(up([{ url: "https://acme.dev", status: "DOWN", up: false }]).state).toBe("missing");
    expect(up([{ url: "https://other.dev", status: "UP", up: true }]).summary).toContain("None of your 1");
  });
  it("asks for confirmation without a connection", () => {
    expect(CHECK_BY_ID["operations.uptime"].evaluate(signals({ site: site() })).state).toBe("needs_confirmation");
  });
});

describe("launch map", () => {
  it("routes every launch blocker into the gate and places operate work after it", () => {
    const plan = buildPlan(ctx({ stage: "launched" }), [], [], null);
    const g = buildLaunchGraph(plan);
    const blockers = plan.filter((i) => i.priority === "blocker").map((i) => i.id);
    expect(g.edges.filter((e) => e.kind === "gate").map((e) => e.source).sort()).toEqual(blockers.sort());
    // backups is a blocker for a launched SaaS, so it sits before the gate
    expect(phaseOf(plan.find((i) => i.id === "operations.backups")!)).toBe("launch");
    expect(g.edges.some((e) => e.kind === "operate" && e.target === "operations.uptime")).toBe(true);
    expect(g.ready).toBe(false);
  });

  it("hides not-applicable items unless asked", () => {
    const plan = buildPlan(ctx(), [], [], null);
    const ids = (show: boolean) => buildLaunchGraph(plan, { showNotApplicable: show }).nodes.map((n) => n.id);
    expect(ids(false)).not.toContain("oss.license");
    expect(ids(true)).toContain("oss.license");
  });

  it("draws dependency edges, satisfied or not", () => {
    const g = buildLaunchGraph(buildPlan(ctx(), [], [], null));
    expect(g.edges.find((e) => e.id === "dep:site.reachable->site.https")).toMatchObject({ kind: "dependency", satisfied: false });
  });

  it("the landing-page sample really has three blockers left", () => {
    const r = readiness(samplePlan());
    expect(r.blockers.total - r.blockers.satisfied).toBe(3);
  });
});
