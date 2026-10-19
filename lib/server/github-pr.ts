// Opening pull requests with generated files. Never touches the default branch
// directly and never overwrites an existing file. Idempotent per branch name:
// re-running finds the existing branch/PR instead of creating duplicates, so a
// half-finished run can be retried safely.

import { gh, GithubError } from "./collect/github";

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface PullRequestRef {
  number: number;
  url: string;
  branch: string;
  state: "open" | "closed" | "merged";
}

interface Pull {
  number: number;
  html_url: string;
  state: "open" | "closed";
  merged_at: string | null;
  head: { ref: string };
}

const toRef = (p: Pull): PullRequestRef => ({ number: p.number, url: p.html_url, branch: p.head.ref, state: p.merged_at ? "merged" : p.state });

export async function verifyGithubToken(token: string): Promise<{ login: string }> {
  const u = await gh<{ login: string }>("/user", token);
  return { login: u.login };
}

/** Paths among `paths` that already exist on the default branch. */
export async function existingPaths(token: string, owner: string, repo: string, paths: string[]): Promise<string[]> {
  const meta = await gh<{ default_branch: string }>(`/repos/${owner}/${repo}`, token);
  const tree = await gh<{ tree: { path: string }[] }>(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(meta.default_branch)}?recursive=1`, token);
  const have = new Set(tree.tree.map((t) => t.path));
  return paths.filter((p) => have.has(p));
}

export async function openPullRequest(
  token: string,
  owner: string,
  repo: string,
  opts: { branch: string; title: string; body: string; files: GeneratedFile[] },
): Promise<PullRequestRef> {
  const meta = await gh<{ default_branch: string; full_name: string }>(`/repos/${owner}/${repo}`, token);
  const [o, r] = meta.full_name.split("/");

  // Already done (or partly done) by an earlier attempt?
  const existing = await gh<Pull[]>(`/repos/${o}/${r}/pulls?state=all&head=${encodeURIComponent(`${o}:${opts.branch}`)}`, token);
  if (existing[0]) return toRef(existing[0]);

  const branchExists = await gh(`/repos/${o}/${r}/git/ref/heads/${encodeURIComponent(opts.branch)}`, token).then(
    () => true,
    (e) => {
      if (e instanceof GithubError && e.status === 404) return false;
      throw e;
    },
  );

  if (!branchExists) {
    const clash = await existingPaths(token, o, r, opts.files.map((f) => f.path));
    if (clash.length) throw new GithubError(`These files already exist and won't be overwritten: ${clash.join(", ")}. Re-assess to refresh the plan.`);
    const base = await gh<{ object: { sha: string } }>(`/repos/${o}/${r}/git/ref/heads/${encodeURIComponent(meta.default_branch)}`, token);
    const baseCommit = await gh<{ tree: { sha: string } }>(`/repos/${o}/${r}/git/commits/${base.object.sha}`, token);
    const tree = await gh<{ sha: string }>(`/repos/${o}/${r}/git/trees`, token, {
      method: "POST",
      body: { base_tree: baseCommit.tree.sha, tree: opts.files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })) },
    });
    const commit = await gh<{ sha: string }>(`/repos/${o}/${r}/git/commits`, token, {
      method: "POST",
      body: { message: opts.title, tree: tree.sha, parents: [base.object.sha] },
    });
    await gh(`/repos/${o}/${r}/git/refs`, token, { method: "POST", body: { ref: `refs/heads/${opts.branch}`, sha: commit.sha } });
  }

  const pr = await gh<Pull>(`/repos/${o}/${r}/pulls`, token, {
    method: "POST",
    body: { title: opts.title, head: opts.branch, base: meta.default_branch, body: opts.body, maintainer_can_modify: true },
  });
  return toRef(pr);
}

export async function pullRequestState(token: string, owner: string, repo: string, number: number): Promise<PullRequestRef> {
  return toRef(await gh<Pull>(`/repos/${owner}/${repo}/pulls/${number}`, token));
}
