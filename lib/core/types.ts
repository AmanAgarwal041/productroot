// Core domain types. Everything in lib/core is pure (no I/O) so it can be unit
// tested and shared between server and client.

export const PRODUCT_TYPES = ["saas", "api", "mobile", "oss", "content", "other"] as const;
export const STAGES = ["prototype", "working", "beta", "launched", "growing"] as const;
export const MONETIZATIONS = ["free", "one_time", "subscription", "usage", "undecided"] as const;
export const BUSINESS_TYPES = ["individual", "sole_proprietor", "company", "undecided"] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];
export type Stage = (typeof STAGES)[number];
export type Monetization = (typeof MONETIZATIONS)[number];
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  saas: "SaaS / web app",
  api: "API / developer tool",
  mobile: "Mobile app",
  oss: "Open-source project",
  content: "Content site",
  other: "Other",
};
export const STAGE_LABEL: Record<Stage, string> = {
  prototype: "Prototype",
  working: "Working app",
  beta: "Beta",
  launched: "Launched",
  growing: "Growing",
};
export const MONETIZATION_LABEL: Record<Monetization, string> = {
  free: "Free",
  one_time: "One-time purchase",
  subscription: "Subscription",
  usage: "Usage-based",
  undecided: "Undecided",
};

export const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  individual: "Individual (no registration)",
  sole_proprietor: "Sole proprietor",
  company: "Registered company",
  undecided: "Not decided yet",
};

/** What the user told us about the product. Drives applicability and priority. */
export interface ProductContext {
  productType: ProductType;
  stage: Stage;
  monetization: Monetization;
  /** ISO 3166-1 alpha-2, where the seller is based. Used for provider eligibility (Phase 2). */
  country: string | null;
  businessType: BusinessType;
  hasRepo: boolean;
  hasSite: boolean;
}

/**
 * How sure we are about a capability.
 * - verified: an independent check (live HTTP, test, provider API) proved it.
 * - detected: evidence exists in the repo or on the site, but nothing proved it works.
 * - confirmed: the user attested it (never upgraded to verified by itself).
 * - needs_confirmation: evidence is inconclusive; ask the user.
 * - missing: an explicit presence check found it absent.
 * - not_applicable: the user or a context rule ruled it out.
 */
export type CheckState = "verified" | "detected" | "confirmed" | "needs_confirmation" | "missing" | "not_applicable";

export const SATISFIED: ReadonlySet<CheckState> = new Set(["verified", "detected", "confirmed", "not_applicable"]);

export type EvidenceSource = "github" | "website" | "metainfo" | "user" | "rule";

export interface Evidence {
  source: EvidenceSource;
  /** File path, URL or dependency name the finding points at. */
  ref: string;
  detail: string;
}

/** Machine result of one check from one assessment. Context-independent. */
export interface CheckResult {
  id: string;
  state: Exclude<CheckState, "confirmed" | "not_applicable">;
  summary: string;
  evidence: Evidence[];
}

export type Priority = "blocker" | "recommended" | "optional";

export type DecisionStatus = "done" | "skipped" | "not_applicable";

export interface Decision {
  checkId: string;
  status: DecisionStatus;
  note: string;
  decidedBy: string;
  decidedAt: string;
}

export type SourceName = "github" | "website" | "metainfo";

export interface SourceStatus {
  source: SourceName;
  status: "ok" | "error" | "skipped";
  message: string;
}

export interface StackSummary {
  languages: string[];
  frameworks: string[];
  packageManager: string | null;
  hosting: string[];
  databases: string[];
  auth: string[];
  billing: string[];
  /** Root package.json script names. */
  scripts: string[];
  /** True when dependency checks could not read a JS/TS manifest. */
  nonJs: boolean;
}
