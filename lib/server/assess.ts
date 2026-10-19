// One assessment run: collect evidence from every available source in
// parallel, then run the deterministic checks. A failing source never fails
// the run; it is reported in `sources` and the affected checks fall back to
// "needs confirmation".

import { evaluateAll } from "@/lib/core/checks";
import type { Signals } from "@/lib/core/signals";
import { detectStack } from "@/lib/core/stack";
import type { CheckResult, SourceStatus, StackSummary } from "@/lib/core/types";
import { parseGithubRepo } from "@/lib/core/urls";
import { collectGithub } from "./collect/github";
import { collectWebsite } from "./collect/website";
import { assertPublic } from "./safe-fetch";
import { metainfoReport } from "./integrations/metainfo";
import { listMonitors, UPTIME_NAME, type UptimeProvider } from "./integrations/uptime";

export interface AssessmentOutcome {
  sources: SourceStatus[];
  results: CheckResult[];
  stack: StackSummary | null;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface AssessOptions {
  /** The workspace's GitHub token, for private repositories. */
  githubToken?: string | null;
  /** A connected uptime monitor, to verify operations.uptime. */
  uptime?: { provider: UptimeProvider; key: string } | null;
}

export async function assess(target: { repoUrl: string | null; siteUrl: string | null }, opts: AssessOptions = {}): Promise<AssessmentOutcome> {
  const gh = target.repoUrl ? parseGithubRepo(target.repoUrl) : null;
  const [repo, site, meta, uptime] = await Promise.allSettled([
    gh ? collectGithub(gh.owner, gh.repo, opts.githubToken ?? null) : Promise.resolve(null),
    target.siteUrl ? collectWebsite(target.siteUrl) : Promise.resolve(null),
    // Never hand a private address to another service either.
    target.siteUrl ? assertPublic(new URL(target.siteUrl)).then(() => metainfoReport(target.siteUrl!)) : Promise.resolve(null),
    opts.uptime ? listMonitors(opts.uptime.provider, opts.uptime.key) : Promise.resolve(null),
  ]);

  const signals: Signals = { repo: null, repoError: null, site: null, siteError: null, metainfo: null, metainfoError: null };
  const sources: SourceStatus[] = [];

  if (!gh) sources.push({ source: "github", status: "skipped", message: "No repository added." });
  else if (repo.status === "fulfilled" && repo.value) {
    signals.repo = repo.value;
    const r = repo.value;
    sources.push({
      source: "github",
      status: "ok",
      message: `${r.private ? "Private repository. " : ""}Read ${r.files.length} file paths and ${r.manifests.length} package.json file${r.manifests.length === 1 ? "" : "s"} from ${r.owner}/${r.repo}@${r.branch}${r.truncated ? " (listing truncated by GitHub)" : ""}.`,
    });
  } else {
    signals.repoError = repo.status === "rejected" ? message(repo.reason) : "Unknown error.";
    sources.push({ source: "github", status: "error", message: signals.repoError });
  }

  if (!target.siteUrl) sources.push({ source: "website", status: "skipped", message: "No website added." });
  else if (site.status === "fulfilled" && site.value) {
    signals.site = site.value;
    sources.push({ source: "website", status: "ok", message: `HTTP ${site.value.status} from ${site.value.finalUrl}; ${site.value.links.length} links on the homepage.` });
  } else {
    signals.siteError = site.status === "rejected" ? message(site.reason) : "Unknown error.";
    sources.push({ source: "website", status: "error", message: signals.siteError });
  }

  if (!target.siteUrl) sources.push({ source: "metainfo", status: "skipped", message: "Needs a website URL." });
  else if (meta.status === "fulfilled" && meta.value?.ok) {
    signals.metainfo = meta.value.data;
    sources.push({ source: "metainfo", status: "ok", message: `Scored ${meta.value.data.overall}/100.` });
  } else {
    signals.metainfoError = meta.status === "rejected" ? message(meta.reason) : meta.value && !meta.value.ok ? meta.value.error : "Unknown error.";
    const notConfigured = meta.status === "fulfilled" && meta.value && !meta.value.ok && /isn't connected/.test(meta.value.error);
    sources.push({ source: "metainfo", status: notConfigured ? "skipped" : "error", message: signals.metainfoError });
  }

  if (opts.uptime) {
    if (uptime.status === "fulfilled" && uptime.value?.ok) signals.uptime = { provider: UPTIME_NAME[opts.uptime.provider], monitors: uptime.value.data };
    else signals.uptimeError = uptime.status === "rejected" ? message(uptime.reason) : uptime.value && !uptime.value.ok ? uptime.value.error : "Unknown error.";
  }

  return { sources, results: evaluateAll(signals), stack: signals.repo ? detectStack(signals.repo) : null };
}
