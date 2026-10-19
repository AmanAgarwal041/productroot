// Workflow runs: propose → approve → execute once → record. Transitions are
// compare-and-set updates on `status`, so two concurrent approvals can't both
// execute. Every step writes an audit event; failures notify the workspace.

import { generate, type GenContext } from "@/lib/core/generators";
import type { Project } from "@/lib/core/project";
import { parseGithubRepo } from "@/lib/core/urls";
import { stableHash, transition, type RunAction, type RunKind, type RunStatus, type WorkflowRun } from "@/lib/core/workflow";
import { InputError, type Caller } from "./auth";
import { getConnection } from "./connections";
import { openPullRequest, pullRequestState, type PullRequestRef } from "./github-pr";
import { socialbreweryCall, socialbreweryTools } from "./integrations/socialbrewery";
import { notifyStatement } from "./notify";

interface Row {
  id: string;
  project_id: string;
  kind: RunKind;
  check_id: string | null;
  title: string;
  input: string;
  status: RunStatus;
  requested_by: string;
  decided_by: string | null;
  decided_at: string | null;
  result: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

const toRun = (r: Row): WorkflowRun => ({
  id: r.id,
  projectId: r.project_id,
  kind: r.kind,
  checkId: r.check_id,
  title: r.title,
  input: JSON.parse(r.input) as Record<string, unknown>,
  status: r.status,
  requestedBy: r.requested_by,
  decidedBy: r.decided_by,
  decidedAt: r.decided_at,
  result: r.result ? (JSON.parse(r.result) as Record<string, unknown>) : null,
  error: r.error,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const now = () => new Date().toISOString();

function audit(db: D1Database, c: Pick<Caller, "owner" | "userId">, projectId: string, action: string, target: string, detail: unknown = {}) {
  return db
    .prepare("INSERT INTO audit_events (id, project_id, owner, actor, action, target, detail, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), projectId, c.owner, c.userId, action, target, JSON.stringify(detail), now());
}

export async function listRuns(db: D1Database, owner: string, projectId?: string): Promise<WorkflowRun[]> {
  const q = projectId
    ? db.prepare("SELECT * FROM workflow_runs WHERE owner = ? AND project_id = ? ORDER BY created_at DESC LIMIT 100").bind(owner, projectId)
    : db.prepare("SELECT * FROM workflow_runs WHERE owner = ? ORDER BY created_at DESC LIMIT 100").bind(owner);
  return (await q.all<Row>()).results.map(toRun);
}

export async function getRun(db: D1Database, owner: string, id: string): Promise<WorkflowRun | null> {
  const r = await db.prepare("SELECT * FROM workflow_runs WHERE owner = ? AND id = ?").bind(owner, id).first<Row>();
  return r ? toRun(r) : null;
}

/** Insert a proposal, or return the active one with the same idempotency key. */
async function propose(db: D1Database, c: Caller, p: { projectId: string; kind: RunKind; checkId: string | null; title: string; input: unknown; key: string }): Promise<WorkflowRun> {
  const existing = await db.prepare("SELECT * FROM workflow_runs WHERE owner = ? AND idempotency_key = ?").bind(c.owner, p.key).first<Row>();
  if (existing && ["pending_approval", "running", "succeeded"].includes(existing.status)) return toRun(existing);
  const key = existing ? `${p.key}:${crypto.randomUUID()}` : p.key; // a terminal earlier attempt doesn't block a new proposal
  const id = crypto.randomUUID();
  const t = now();
  await db.batch([
    db
      .prepare(
        `INSERT INTO workflow_runs (id, project_id, owner, kind, check_id, title, input, status, idempotency_key, requested_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?, ?, ?, ?)`,
      )
      .bind(id, p.projectId, c.owner, p.kind, p.checkId, p.title, JSON.stringify(p.input), key, c.userId, t, t),
    audit(db, c, p.projectId, "workflow.propose", id, { kind: p.kind, title: p.title }),
    notifyStatement(db, c.owner, p.projectId, "approval_needed", `Approval needed: ${p.title}`),
  ]);
  return (await getRun(db, c.owner, id))!;
}

export async function proposePullRequest(db: D1Database, c: Caller, project: Project, checkIds: string[], params: Record<string, Record<string, string>>): Promise<WorkflowRun> {
  const gh = project.repoUrl ? parseGithubRepo(project.repoUrl) : null;
  if (!gh) throw new InputError("Add a GitHub repository to this project first.");
  if (!(await getConnection(db, c.owner, "github"))) throw new InputError("Connect GitHub in Integrations to open pull requests.");
  const s = project.stack;
  const ctx: GenContext = {
    owner: gh.owner,
    repo: gh.repo,
    productName: project.name,
    siteUrl: project.siteUrl,
    packageManager: s?.packageManager ?? null,
    scripts: s?.scripts ?? [],
    js: !!s && !s.nonJs,
  };
  const ids = [...new Set(checkIds)].sort();
  const g = generate(ctx, ids, params);
  if (!g.ok) throw new InputError(g.error);
  const title = ids.length === 1 ? `Add ${g.files.map((f) => f.path.split("/").pop()).join(", ")}` : `Launch readiness: add ${g.files.length} files`;
  return propose(db, c, {
    projectId: project.id,
    kind: "github.pull_request",
    checkId: ids.length === 1 ? ids[0] : null,
    title,
    input: { repo: gh, checkIds: ids, files: g.files },
    key: `pr:${project.id}:${stableHash(g.files)}`,
  });
}

export async function proposeSocialPost(db: D1Database, c: Caller, project: Project, tool: string, args: Record<string, unknown>): Promise<WorkflowRun> {
  const conn = await getConnection(db, c.owner, "socialbrewery");
  if (!conn) throw new InputError("Connect SocialBrewery in Integrations first.");
  const tools = await socialbreweryTools({ url: String(conn.meta.url), token: conn.secret });
  if (!tools.ok) throw new InputError(tools.error, 502);
  const def = tools.data.find((t) => t.name === tool);
  if (!def || !def.consequential || !/^post_|^publish_/.test(tool)) throw new InputError("Choose one of SocialBrewery's posting tools.");
  // Keep only declared string/boolean/number fields; drop empties.
  const props = def.inputSchema.properties ?? {};
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (!(k in props) || v === "" || v === null || v === undefined) continue;
    const t = props[k].type;
    if (t === "boolean") clean[k] = v === true || v === "true";
    else if (t === "number" || t === "integer") clean[k] = Number(v);
    else if (typeof v === "string") clean[k] = v.slice(0, 10_000);
  }
  for (const req of def.inputSchema.required ?? []) if (!(req in clean)) throw new InputError(`"${req}" is required for ${tool}.`);
  return propose(db, c, {
    projectId: project.id,
    kind: "socialbrewery.post",
    checkId: "growth.launch_announcement",
    title: `Publish via ${tool}`,
    input: { tool, args: clean },
    key: `post:${project.id}:${tool}:${stableHash(clean)}`,
  });
}

/** Apply an action. Approve/retry execute synchronously and return the final run. */
export async function act(db: D1Database, c: Caller, id: string, action: RunAction): Promise<WorkflowRun> {
  const run = await getRun(db, c.owner, id);
  if (!run) throw new InputError("Workflow run not found.", 404);
  const tr = transition(run, action, c);
  if (!tr.ok) throw new InputError(tr.error, tr.status);

  const t = now();
  const res = await db
    .prepare("UPDATE workflow_runs SET status = ?, decided_by = COALESCE(?, decided_by), decided_at = COALESCE(?, decided_at), error = NULL, updated_at = ? WHERE id = ? AND owner = ? AND status = ?")
    .bind(tr.to, action === "retry" ? null : c.userId, action === "retry" ? null : t, t, id, c.owner, tr.from)
    .run();
  if (res.meta.changes !== 1) throw new InputError("Someone else acted on this run at the same time. Refresh and try again.", 409);
  await audit(db, c, run.projectId, `workflow.${action}`, id).run();
  if (tr.to !== "running") return (await getRun(db, c.owner, id))!;

  let outcome: { ok: true; result: Record<string, unknown> } | { ok: false; error: string };
  try {
    outcome = await execute(db, c.owner, run);
  } catch (e) {
    outcome = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  await db.batch([
    db
      .prepare("UPDATE workflow_runs SET status = ?, result = ?, error = ?, updated_at = ? WHERE id = ? AND owner = ?")
      .bind(outcome.ok ? "succeeded" : "failed", outcome.ok ? JSON.stringify(outcome.result) : null, outcome.ok ? null : outcome.error.slice(0, 2000), now(), id, c.owner),
    audit(db, c, run.projectId, outcome.ok ? "workflow.succeeded" : "workflow.failed", id, outcome.ok ? {} : { error: outcome.error.slice(0, 300) }),
    notifyStatement(db, c.owner, run.projectId, outcome.ok ? "workflow_succeeded" : "workflow_failed", `${outcome.ok ? "Done" : "Failed"}: ${run.title}`, outcome.ok ? "" : outcome.error),
  ]);
  return (await getRun(db, c.owner, id))!;
}

async function execute(db: D1Database, owner: string, run: WorkflowRun): Promise<{ ok: true; result: Record<string, unknown> } | { ok: false; error: string }> {
  if (run.kind === "github.pull_request") {
    const conn = await getConnection(db, owner, "github");
    if (!conn) return { ok: false, error: "GitHub is no longer connected." };
    const input = run.input as { repo: { owner: string; repo: string }; checkIds: string[]; files: { path: string; content: string }[] };
    const pr = await openPullRequest(conn.secret, input.repo.owner, input.repo.repo, {
      branch: `productroot/${run.id.slice(0, 8)}`,
      title: run.title,
      body: [
        "Opened by ProductRoot after approval in the workspace.",
        "",
        "Adds:",
        ...input.files.map((f) => `- \`${f.path}\``),
        "",
        "Review the files, adjust anything that doesn't fit, and merge when ready. Nothing on the default branch was changed. Re-assess the project in ProductRoot after merging to update readiness.",
      ].join("\n"),
      files: input.files,
    });
    return { ok: true, result: { pr } };
  }
  const conn = await getConnection(db, owner, "socialbrewery");
  if (!conn) return { ok: false, error: "SocialBrewery is no longer connected." };
  const input = run.input as { tool: string; args: Record<string, unknown> };
  const r = await socialbreweryCall({ url: String(conn.meta.url), token: conn.secret }, input.tool, input.args);
  return r.ok ? { ok: true, result: { output: r.data } } : { ok: false, error: r.error };
}

/** Verification for a succeeded PR run: is the pull request open, merged or closed? */
export async function refreshRun(db: D1Database, c: Caller, id: string): Promise<WorkflowRun> {
  const run = await getRun(db, c.owner, id);
  if (!run) throw new InputError("Workflow run not found.", 404);
  if (run.kind !== "github.pull_request" || run.status !== "succeeded") return run;
  const conn = await getConnection(db, c.owner, "github");
  if (!conn) throw new InputError("Connect GitHub to check the pull request.");
  const pr = run.result?.pr as PullRequestRef;
  const input = run.input as { repo: { owner: string; repo: string } };
  const fresh = await pullRequestState(conn.secret, input.repo.owner, input.repo.repo, pr.number);
  await db.prepare("UPDATE workflow_runs SET result = ?, updated_at = ? WHERE id = ? AND owner = ?").bind(JSON.stringify({ ...run.result, pr: fresh, checkedAt: now() }), now(), id, c.owner).run();
  return (await getRun(db, c.owner, id))!;
}
