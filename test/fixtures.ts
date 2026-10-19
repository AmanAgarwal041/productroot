import type { RepoSignals, Signals, SiteSignals } from "@/lib/core/signals";
import type { ProductContext } from "@/lib/core/types";

export const repo = (over: Partial<RepoSignals> = {}): RepoSignals => ({
  owner: "acme",
  repo: "app",
  branch: "main",
  files: ["package.json", "README.md"],
  truncated: false,
  deps: {},
  scripts: {},
  private: false,
  manifests: ["package.json"],
  license: null,
  ...over,
});

export const site = (over: Partial<SiteSignals> = {}): SiteSignals => ({
  requestedUrl: "https://acme.dev/",
  finalUrl: "https://acme.dev/",
  status: 200,
  headers: {},
  title: "Acme",
  links: [],
  scripts: [],
  ...over,
});

export const signals = (over: Partial<Signals> = {}): Signals => ({
  repo: null,
  repoError: null,
  site: null,
  siteError: null,
  metainfo: null,
  metainfoError: null,
  ...over,
});

export const ctx = (over: Partial<ProductContext> = {}): ProductContext => ({
  productType: "saas",
  stage: "beta",
  monetization: "subscription",
  country: null,
  businessType: "undecided",
  hasRepo: true,
  hasSite: true,
  ...over,
});
