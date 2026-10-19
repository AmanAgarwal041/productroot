// A sample assessment for the landing page: a beta SaaS on subscriptions
// partway to launch. Illustrative only.

import { CHECKS } from "./checks";
import { buildPlan } from "./plan";
import type { CheckResult } from "./types";

const STATES: Record<string, CheckResult["state"]> = {
  "auth.present": "detected",
  "auth.recovery": "detected",
  "auth.deletion": "needs_confirmation",
  "security.rate_limit": "needs_confirmation",
  "billing.provider": "detected",
  "billing.webhooks": "needs_confirmation",
  "billing.self_service": "missing",
  "billing.pricing_page": "detected",
  "legal.privacy": "missing",
  "legal.terms": "missing",
  "site.reachable": "verified",
  "site.https": "verified",
  "infra.deploy_config": "detected",
  "infra.env_template": "detected",
  "infra.db_migrations": "detected",
  "operations.backups": "needs_confirmation",
  "security.secrets": "detected",
  "security.headers": "missing",
  "quality.tests": "detected",
  "quality.ci": "missing",
  "quality.lockfile": "detected",
  "operations.error_tracking": "detected",
  "operations.uptime": "needs_confirmation",
  "operations.email": "detected",
  "growth.analytics": "needs_confirmation",
  "growth.discoverability": "verified",
  "growth.launch_announcement": "needs_confirmation",
  "support.channel": "detected",
};

export function samplePlan() {
  const results: CheckResult[] = CHECKS.map((c) => ({ id: c.id, state: STATES[c.id] ?? "needs_confirmation", summary: "", evidence: [] }));
  return buildPlan(
    { productType: "saas", stage: "beta", monetization: "subscription", country: "US", businessType: "company", hasRepo: true, hasSite: true },
    results,
    [],
    "2026-10-15T00:00:00Z",
  );
}
