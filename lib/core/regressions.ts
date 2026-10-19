// Regressions: something that was in place is now explicitly missing (for
// example security headers dropped by a deploy, or a site that went down).

import { CHECK_BY_ID } from "./checks";
import type { CheckResult } from "./types";

export interface Regression {
  checkId: string;
  title: string;
  before: CheckResult["state"];
  summary: string;
}

const WAS_OK = new Set<CheckResult["state"]>(["verified", "detected"]);

export function findRegressions(prev: CheckResult[] | null, next: CheckResult[]): Regression[] {
  if (!prev) return [];
  const before = new Map(prev.map((r) => [r.id, r.state]));
  return next
    .filter((r) => r.state === "missing" && WAS_OK.has(before.get(r.id) ?? "missing"))
    .map((r) => ({ checkId: r.id, title: CHECK_BY_ID[r.id]?.title ?? r.id, before: before.get(r.id)!, summary: r.summary }));
}
