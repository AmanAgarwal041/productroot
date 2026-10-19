// Project shape shared by API and UI, plus input validation.

import { BUSINESS_TYPES, MONETIZATIONS, PRODUCT_TYPES, STAGES, type BusinessType, type CheckResult, type Decision, type Monetization, type ProductContext, type ProductType, type SourceStatus, type Stage, type StackSummary } from "./types";
import { normalizeSiteUrl, parseGithubRepo } from "./urls";

export interface Project {
  id: string;
  name: string;
  description: string;
  repoUrl: string | null;
  siteUrl: string | null;
  productType: ProductType;
  stage: Stage;
  monetization: Monetization;
  country: string | null;
  businessType: BusinessType;
  /** Scheduled re-assessment is on. */
  recheck: boolean;
  stack: StackSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface Assessment {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  sources: SourceStatus[];
  results: CheckResult[];
}

export interface ProjectDetail {
  project: Project;
  assessment: Assessment | null;
  decisions: Decision[];
  /** Chosen provider id per capability. */
  choices: Record<string, string>;
}

export type ProjectInput = Pick<Project, "name" | "description" | "repoUrl" | "siteUrl" | "productType" | "stage" | "monetization" | "country" | "businessType" | "recheck">;

export const contextOf = (p: Pick<Project, "productType" | "stage" | "monetization" | "country" | "businessType" | "repoUrl" | "siteUrl">): ProductContext => ({
  productType: p.productType,
  stage: p.stage,
  monetization: p.monetization,
  country: p.country,
  businessType: p.businessType,
  hasRepo: !!p.repoUrl,
  hasSite: !!p.siteUrl,
});

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, values: readonly T[]): T | null => (values.includes(v as T) ? (v as T) : null);

export type Validation = { ok: true; value: ProjectInput } | { ok: false; error: string };

/** Validate and normalise user input. With `partial`, missing fields fall back to `current`. */
export function validateProjectInput(body: unknown, current?: ProjectInput): Validation {
  if (!body || typeof body !== "object") return { ok: false, error: "Expected a JSON object." };
  const b = body as Record<string, unknown>;
  const has = (k: string) => k in b;

  let repoUrl = current?.repoUrl ?? null;
  if (has("repoUrl")) {
    const raw = str(b.repoUrl, 300);
    if (raw) {
      const gh = parseGithubRepo(raw);
      if (!gh) return { ok: false, error: "Repository must be a GitHub URL like https://github.com/owner/repo." };
      repoUrl = `https://github.com/${gh.owner}/${gh.repo}`;
    } else repoUrl = null;
  }

  let siteUrl = current?.siteUrl ?? null;
  if (has("siteUrl")) {
    const raw = str(b.siteUrl, 500);
    if (raw) {
      const u = normalizeSiteUrl(raw);
      if (!u) return { ok: false, error: "Website must be a public http(s) URL." };
      siteUrl = u;
    } else siteUrl = null;
  }

  if (!repoUrl && !siteUrl) return { ok: false, error: "Add a GitHub repository, a website URL, or both." };

  const productType = has("productType") ? oneOf(b.productType, PRODUCT_TYPES) : (current?.productType ?? null);
  const stage = has("stage") ? oneOf(b.stage, STAGES) : (current?.stage ?? null);
  const monetization = has("monetization") ? oneOf(b.monetization, MONETIZATIONS) : (current?.monetization ?? null);
  if (!productType) return { ok: false, error: "Choose a product type." };
  if (!stage) return { ok: false, error: "Choose a stage." };
  if (!monetization) return { ok: false, error: "Choose how the product makes money." };

  let country = current?.country ?? null;
  if (has("country")) {
    const c = str(b.country, 2).toUpperCase();
    if (c && !/^[A-Z]{2}$/.test(c)) return { ok: false, error: "Country must be a two-letter code." };
    country = c || null;
  }

  const businessType = has("businessType") ? oneOf(b.businessType, BUSINESS_TYPES) : (current?.businessType ?? "undecided");
  if (!businessType) return { ok: false, error: "Choose a business type." };
  const recheck = has("recheck") ? b.recheck !== false : (current?.recheck ?? true);

  const fallbackName = repoUrl ? parseGithubRepo(repoUrl)!.repo : siteUrl ? new URL(siteUrl).hostname.replace(/^www\./, "") : "";
  const name = (has("name") ? str(b.name, 80) : current?.name) || fallbackName;
  const description = has("description") ? str(b.description, 500) : (current?.description ?? "");

  return { ok: true, value: { name, description, repoUrl, siteUrl, productType, stage, monetization, country, businessType, recheck } };
}
