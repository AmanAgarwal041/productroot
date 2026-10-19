// Turns stored check results + user decisions + current context into the
// prioritised launch plan. Pure; recomputed on every read.

import { CHECKS, type Area, type Tool } from "./checks";
import { SATISFIED, type CheckResult, type CheckState, type Decision, type Evidence, type Priority, type ProductContext } from "./types";

export type ItemStatus = "open" | "done" | "skipped" | "not_applicable";

export interface PlanItem {
  id: string;
  area: Area;
  title: string;
  why: string;
  recommendation: string;
  effort: "minutes" | "hours" | "days";
  verify: string;
  question: string;
  tools: Tool[];
  /** null when a context rule says it doesn't apply. */
  priority: Priority | null;
  state: CheckState;
  status: ItemStatus;
  summary: string;
  evidence: Evidence[];
  decision: Decision | null;
  /** All prerequisites (check ids). */
  dependsOn: string[];
  /** Unsatisfied prerequisites (check ids). */
  blockedBy: string[];
  /** The user marked it done, but a later assessment found it missing. */
  reopened: boolean;
}

export interface Readiness {
  blockers: { total: number; satisfied: number; skipped: number };
  recommended: { total: number; satisfied: number };
  needsConfirmation: number;
  /** Every launch blocker is satisfied or not applicable. */
  launchReady: boolean;
  /** Ready only because some blockers were skipped (accepted risk). */
  readyWithRisks: boolean;
}

const PRIORITY_ORDER: Record<Priority, number> = { blocker: 0, recommended: 1, optional: 2 };
const STATE_ORDER: Record<CheckState, number> = { missing: 0, needs_confirmation: 1, detected: 2, confirmed: 3, verified: 4, not_applicable: 5 };

export function buildPlan(ctx: ProductContext, results: CheckResult[] | null, decisions: Decision[], assessedAt: string | null): PlanItem[] {
  const byId = new Map((results ?? []).map((r) => [r.id, r]));
  const decisionById = new Map(decisions.map((d) => [d.checkId, d]));

  const items = CHECKS.map((def): PlanItem => {
    const priority = def.priority(ctx);
    const machine = byId.get(def.id);
    const decision = decisionById.get(def.id) ?? null;
    const base = {
      id: def.id,
      area: def.area,
      title: def.title,
      why: def.why,
      recommendation: def.recommendation,
      effort: def.effort,
      verify: def.verify,
      question: def.question,
      tools: def.tools ?? [],
      priority,
      decision,
      dependsOn: def.dependsOn ?? [],
      blockedBy: [] as string[],
      reopened: false,
      evidence: machine?.evidence ?? [],
      summary: machine?.summary ?? "Not assessed yet.",
    };
    const machineState: CheckState = machine?.state ?? "needs_confirmation";

    if (priority === null) return { ...base, state: "not_applicable", status: "not_applicable", summary: "Not needed for this kind of product." };
    if (decision?.status === "not_applicable") return { ...base, state: "not_applicable", status: "not_applicable" };

    if (decision?.status === "done") {
      if (machineState === "verified") return { ...base, state: "verified", status: "done" };
      // A newer explicit "missing" finding overrides an older manual confirmation.
      if (machineState === "missing" && assessedAt && assessedAt > decision.decidedAt) return { ...base, state: "missing", status: "open", reopened: true };
      return { ...base, state: "confirmed", status: "done" };
    }

    if (SATISFIED.has(machineState)) return { ...base, state: machineState, status: "done" };
    return { ...base, state: machineState, status: decision?.status === "skipped" ? "skipped" : "open" };
  });

  const satisfied = new Map(items.map((i) => [i.id, SATISFIED.has(i.state)]));
  for (const item of items) item.blockedBy = item.dependsOn.filter((d) => !satisfied.get(d));

  return items.sort(
    (a, b) =>
      (a.priority === null ? 9 : PRIORITY_ORDER[a.priority]) - (b.priority === null ? 9 : PRIORITY_ORDER[b.priority]) ||
      Number(a.blockedBy.length > 0) - Number(b.blockedBy.length > 0) ||
      STATE_ORDER[a.state] - STATE_ORDER[b.state],
  );
}

export function readiness(items: PlanItem[]): Readiness {
  const blockers = items.filter((i) => i.priority === "blocker");
  const recommended = items.filter((i) => i.priority === "recommended");
  const ok = (i: PlanItem) => SATISFIED.has(i.state);
  const skipped = blockers.filter((i) => i.status === "skipped").length;
  const unsatisfiedOpen = blockers.filter((i) => !ok(i) && i.status !== "skipped").length;
  return {
    blockers: { total: blockers.length, satisfied: blockers.filter(ok).length, skipped },
    recommended: { total: recommended.length, satisfied: recommended.filter(ok).length },
    needsConfirmation: items.filter((i) => i.priority !== null && i.status === "open" && i.state === "needs_confirmation").length,
    launchReady: unsatisfiedOpen === 0 && skipped === 0,
    readyWithRisks: unsatisfiedOpen === 0 && skipped > 0,
  };
}
