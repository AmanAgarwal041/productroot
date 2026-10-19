// Normalised evidence gathered by the collectors (lib/server/collect/*). Signals
// live only for the duration of an assessment; what is persisted is the
// derived CheckResult list and StackSummary.

export interface RepoSignals {
  owner: string;
  repo: string;
  branch: string;
  /** Every file path in the default branch (vendor dirs removed). */
  files: string[];
  /** The tree listing was cut off by GitHub; absence findings are unreliable. */
  truncated: boolean;
  /** Merged dependencies + devDependencies of every package.json read. */
  deps: Record<string, string>;
  /** Root package.json scripts (names → commands), for generated CI. */
  scripts: Record<string, string>;
  private: boolean;
  /** package.json paths that were read. */
  manifests: string[];
  license: string | null;
}

export interface LinkInfo {
  href: string;
  text: string;
}

export interface SiteSignals {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  /** Lower-cased response headers we care about. */
  headers: Record<string, string>;
  title: string | null;
  links: LinkInfo[];
  scripts: string[];
}

export interface MetaInfoFailing {
  id: string;
  status: "fail" | "warn";
  severity: string;
  title: string;
  finding: string;
}

export interface MetaInfoSignals {
  url: string;
  scannedAt: string;
  overall: number;
  critical: number;
  scores: Record<string, number>;
  failing: MetaInfoFailing[];
  /** Link back to the full report in MetaInfo's UI. */
  reportUrl: string;
}

export interface UptimeMonitor {
  url: string;
  status: string;
  up: boolean;
}

export interface UptimeSignals {
  provider: string;
  monitors: UptimeMonitor[];
}

export interface Signals {
  repo: RepoSignals | null;
  repoError: string | null;
  site: SiteSignals | null;
  siteError: string | null;
  metainfo: MetaInfoSignals | null;
  metainfoError: string | null;
  /** From a connected uptime monitor; null when none is connected. */
  uptime?: UptimeSignals | null;
  uptimeError?: string | null;
}
