import { describe, expect, it } from "vitest";
import { buildPlan, readiness } from "@/lib/core/plan";
import type { CheckResult, Decision } from "@/lib/core/types";
import { ctx } from "./fixtures";

const res = (id: string, state: CheckResult["state"]): CheckResult => ({ id, state, summary: "", evidence: [] });
const dec = (checkId: string, status: Decision["status"], decidedAt = "2026-10-01T00:00:00Z"): Decision => ({ checkId, status, note: "", decidedBy: "u", decidedAt });
const item = (plan: ReturnType<typeof buildPlan>, id: string) => plan.find((i) => i.id === id)!;

describe("buildPlan", () => {
  it("marks context-excluded checks not applicable", () => {
    const plan = buildPlan(ctx({ monetization: "free" }), [], [], null);
    expect(item(plan, "billing.provider")).toMatchObject({ priority: null, state: "not_applicable", status: "not_applicable" });
  });

  it("turns a manual 'done' into confirmed, never verified", () => {
    const plan = buildPlan(ctx(), [res("operations.backups", "needs_confirmation")], [dec("operations.backups", "done")], "2026-10-02T00:00:00Z");
    expect(item(plan, "operations.backups")).toMatchObject({ state: "confirmed", status: "done" });
  });

  it("keeps verified when the machine verified it", () => {
    const plan = buildPlan(ctx(), [res("site.https", "verified")], [dec("site.https", "done")], "2026-10-02T00:00:00Z");
    expect(item(plan, "site.https").state).toBe("verified");
  });

  it("reopens a confirmed task when a newer scan finds it missing", () => {
    const plan = buildPlan(ctx(), [res("quality.ci", "missing")], [dec("quality.ci", "done", "2026-10-01T00:00:00Z")], "2026-10-05T00:00:00Z");
    expect(item(plan, "quality.ci")).toMatchObject({ state: "missing", status: "open", reopened: true });
  });

  it("does not reopen when the decision is newer than the scan", () => {
    const plan = buildPlan(ctx(), [res("quality.ci", "missing")], [dec("quality.ci", "done", "2026-10-06T00:00:00Z")], "2026-10-05T00:00:00Z");
    expect(item(plan, "quality.ci")).toMatchObject({ state: "confirmed", status: "done" });
  });

  it("records blocked dependencies", () => {
    const plan = buildPlan(ctx(), [res("billing.provider", "needs_confirmation"), res("billing.webhooks", "detected")], [], "2026-10-05T00:00:00Z");
    expect(item(plan, "billing.webhooks").blockedBy).toEqual(["billing.provider"]);
    const plan2 = buildPlan(ctx(), [res("site.reachable", "missing"), res("security.headers", "missing")], [], "x");
    expect(item(plan2, "security.headers").blockedBy).toEqual(["site.reachable"]);
  });

  it("treats a not-applicable dependency as satisfied", () => {
    const plan = buildPlan(ctx(), [res("auth.present", "needs_confirmation")], [dec("auth.present", "not_applicable")], "x");
    expect(item(plan, "auth.recovery").blockedBy).toEqual([]);
  });

  it("sorts blockers first", () => {
    const plan = buildPlan(ctx(), [], [], null);
    const firstNonBlocker = plan.findIndex((i) => i.priority !== "blocker");
    expect(plan.slice(firstNonBlocker).some((i) => i.priority === "blocker")).toBe(false);
  });
});

describe("readiness", () => {
  it("is launch-ready only when every blocker is satisfied", () => {
    const c = ctx({ productType: "oss", monetization: "free", stage: "working" });
    const blockers = buildPlan(c, [], [], null).filter((i) => i.priority === "blocker").map((i) => i.id);
    const allDone = blockers.map((id) => dec(id, "done"));
    expect(readiness(buildPlan(c, [], allDone, null)).launchReady).toBe(true);
    const r = readiness(buildPlan(c, [], [...allDone.slice(1), dec(blockers[0], "skipped")], null));
    expect(r).toMatchObject({ launchReady: false, readyWithRisks: true });
  });
});
