// Provider catalog (Milestone 3). Facts come from catalog-data.ts, each
// provider carrying its sources and the date they were last verified.
// Comparison is deterministic and explainable:
// - eligibility (seller country, business type) is a hard rule and is never
//   guessed: missing facts surface as "unknown, check the source";
// - fit (already in your code, official SDK for your framework, merchant of
//   record, setup effort) orders eligible options;
// - price is shown, never used alone to rank.

import type { BusinessType, ProductContext } from "./types";

export const CAPABILITIES = ["payments", "auth", "hosting", "error_tracking", "uptime", "email", "analytics"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABEL: Record<Capability, string> = {
  payments: "Payments",
  auth: "Authentication",
  hosting: "Hosting",
  error_tracking: "Error tracking",
  uptime: "Uptime monitoring",
  email: "Transactional email",
  analytics: "Analytics",
};

/** Which plan items a capability's provider choice helps with. */
export const CAPABILITY_CHECKS: Record<Capability, string[]> = {
  payments: ["billing.provider", "billing.webhooks", "billing.self_service"],
  auth: ["auth.present", "auth.recovery", "auth.deletion"],
  hosting: ["infra.deploy_config", "site.reachable"],
  error_tracking: ["operations.error_tracking"],
  uptime: ["operations.uptime"],
  email: ["operations.email"],
  analytics: ["growth.analytics"],
};

export const capabilityForCheck = (checkId: string): Capability | null =>
  (Object.entries(CAPABILITY_CHECKS).find(([, ids]) => ids.includes(checkId))?.[0] as Capability | undefined) ?? null;

export interface ProviderOption {
  id: string;
  name: string;
  capability: Capability;
  summary: string;
  website: string;
  pricingModel: string;
  freeTier: string | null;
  fees: string | null;
  merchantOfRecord: boolean | null;
  sellerCountries: "global" | string[] | null;
  businessTypes: Exclude<BusinessType, "undecided">[] | null;
  frameworks: string[];
  setup: "minutes" | "hours" | "days";
  prerequisites: string[];
  limitations: string[];
  sources: { label: string; url: string }[];
  verifiedAt: string;
  /** How deep ProductRoot's own support goes. */
  integration: "integrated" | "guided";
  /** Stack-detection label(s) that mean "already in use" (see lib/core/stack.ts). */
  detectAs?: string[];
}

export type Eligibility = "eligible" | "ineligible" | "unknown";

export interface Reason {
  tone: "plus" | "minus" | "info";
  text: string;
}

export interface ProviderFit {
  provider: ProviderOption;
  eligibility: Eligibility;
  reasons: Reason[];
  score: number;
  inUse: boolean;
  stale: boolean;
}

export interface FitContext extends Pick<ProductContext, "country" | "businessType" | "monetization"> {
  frameworks: string[];
  /** Provider labels detected in the stack (auth, billing, hosting). */
  detected: string[];
}

export const STALE_DAYS = 90;

const BUSINESS_LABEL: Record<Exclude<BusinessType, "undecided">, string> = { individual: "individuals", sole_proprietor: "sole proprietors", company: "registered companies" };

export function fitProvider(p: ProviderOption, ctx: FitContext, today: Date): ProviderFit {
  const reasons: Reason[] = [];
  let eligibility = "eligible" as Eligibility;
  let score = 0;
  const downgrade = (to: Eligibility) => {
    if (eligibility === "ineligible") return;
    if (to === "ineligible" || eligibility === "eligible") eligibility = to;
  };

  const inUse = (p.detectAs ?? [p.name]).some((l) => ctx.detected.includes(l));
  if (inUse) {
    reasons.push({ tone: "plus", text: "Already in your codebase. Finishing the setup beats switching." });
    score += 50;
  }

  if (p.capability === "payments") {
    if (!ctx.country) {
      downgrade("unknown");
      reasons.push({ tone: "info", text: "Add your country to check whether you can sell with it." });
    } else if (p.sellerCountries === "global") {
      reasons.push({ tone: "plus", text: "Available to sellers worldwide (per source)." });
    } else if (Array.isArray(p.sellerCountries)) {
      if (p.sellerCountries.includes(ctx.country)) reasons.push({ tone: "plus", text: `Accepts sellers based in ${ctx.country} (per source).` });
      else {
        downgrade("ineligible");
        reasons.push({ tone: "minus", text: `Not listed as available to sellers in ${ctx.country}.` });
      }
    } else {
      downgrade("unknown");
      reasons.push({ tone: "info", text: "Seller-country availability isn't confirmed. Check the source before relying on it." });
    }

    if (ctx.businessType !== "undecided") {
      if (p.businessTypes === null) {
        downgrade("unknown");
        reasons.push({ tone: "info", text: `Whether it accepts ${BUSINESS_LABEL[ctx.businessType]} isn't confirmed.` });
      } else if (p.businessTypes.includes(ctx.businessType)) reasons.push({ tone: "plus", text: `Accepts ${BUSINESS_LABEL[ctx.businessType]}.` });
      else {
        downgrade("ineligible");
        reasons.push({ tone: "minus", text: `Doesn't accept ${BUSINESS_LABEL[ctx.businessType]} as sellers.` });
      }
    }

    if (p.merchantOfRecord === true) {
      reasons.push({ tone: "plus", text: "Merchant of record: collects and remits sales tax/VAT for you. Simplest when selling internationally without a tax setup." });
      score += ctx.businessType === "individual" || ctx.businessType === "undecided" ? 12 : 5;
    } else if (p.merchantOfRecord === false) {
      reasons.push({ tone: "info", text: "Payment processor, not a merchant of record: sales tax registration and filing are your responsibility." });
    }
  }

  const fw = p.frameworks.filter((f) => ctx.frameworks.includes(f));
  if (fw.length) {
    reasons.push({ tone: "plus", text: `Official SDK or guide for ${fw.join(", ")}.` });
    score += 10;
  } else if (p.frameworks.length === 0) reasons.push({ tone: "info", text: "Framework-agnostic." });
  else if (ctx.frameworks.length) reasons.push({ tone: "info", text: `No official guide for ${ctx.frameworks.join(", ")} listed.` });

  score += { minutes: 4, hours: 2, days: 0 }[p.setup];
  if (p.integration === "integrated") score += 3;

  const ageDays = (today.getTime() - Date.parse(p.verifiedAt)) / 86_400_000;
  const stale = !(ageDays <= STALE_DAYS);
  if (stale) reasons.push({ tone: "info", text: `Facts last verified ${p.verifiedAt}; pricing and availability may have changed.` });

  if (eligibility === "ineligible") score -= 1000;
  if (eligibility === "unknown") score -= 5;
  return { provider: p, eligibility, reasons, score, inUse, stale };
}

export function compareProviders(catalog: ProviderOption[], capability: Capability, ctx: FitContext, today = new Date()): ProviderFit[] {
  return catalog
    .filter((p) => p.capability === capability)
    .map((p) => fitProvider(p, ctx, today))
    .sort((a, b) => b.score - a.score || a.provider.name.localeCompare(b.provider.name));
}
