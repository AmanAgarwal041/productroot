// D1 data access. Every query is scoped by `owner` so one workspace can never
// read another's projects.

import { buildPlan, readiness } from "@/lib/core/plan";
import { contextOf, type Assessment, type Project, type ProjectDetail, type ProjectInput } from "@/lib/core/project";
import type { CheckResult, Decision, DecisionStatus, SourceStatus, StackSummary } from "@/lib/core/types";
import type { Caller } from "./auth";

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  repo_url: string | null;
  site_url: string | null;
  product_type: Project["productType"];
  stage: Project["stage"];
  monetization: Project["monetization"];
  country: string | null;
  business_type: Project["businessType"];
  recheck: number;
  stack: string | null;
  created_at: string;
  updated_at: string;
}

const parse = <T>(s: string | null, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

const toProject = (r: ProjectRow): Project => ({
  id: r.id,
  name: r.name,
  description: r.description,
  repoUrl: r.repo_url,
  siteUrl: r.site_url,
  productType: r.product_type,
  stage: r.stage,
  monetization: r.monetization,
  country: r.country,
  businessType: r.business_type ?? "undecided",
  recheck: r.recheck !== 0,
  stack: parse<StackSummary | null>(r.stack, null),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const now = () => new Date().toISOString();

export interface ProjectListItem extends Project {
  lastAssessedAt: string | null;
  summary: { blockersDone: number; blockersTotal: number; open: number; launchReady: boolean; readyWithRisks: boolean } | null;
  pendingApprovals: number;
}

export async function listProjects(db: D1Database, c: Caller): Promise<ProjectListItem[]> {
  const [p, a, d, w] = await db.batch([
    db.prepare("SELECT * FROM projects WHERE owner = ? ORDER BY updated_at DESC LIMIT 200").bind(c.owner),
    db
      .prepare(
        `SELECT a.project_id, a.results, a.finished_at FROM assessments a JOIN projects p ON p.id = a.project_id
         WHERE p.owner = ? AND a.finished_at IS NOT NULL
         AND a.started_at = (SELECT MAX(started_at) FROM assessments b WHERE b.project_id = a.project_id AND b.finished_at IS NOT NULL)`,
      )
      .bind(c.owner),
    db.prepare("SELECT d.* FROM decisions d JOIN projects p ON p.id = d.project_id WHERE p.owner = ?").bind(c.owner),
    db.prepare("SELECT project_id, COUNT(*) AS n FROM workflow_runs WHERE owner = ? AND status = 'pending_approval' GROUP BY project_id").bind(c.owner),
  ]);
  const latest = new Map((a.results as { project_id: string; results: string; finished_at: string }[]).map((r) => [r.project_id, r]));
  const pending = new Map((w.results as { project_id: string; n: number }[]).map((r) => [r.project_id, r.n]));
  const decisionRows = d.results as { project_id: string; check_id: string; status: DecisionStatus; note: string; decided_by: string; decided_at: string }[];
  return (p.results as unknown as ProjectRow[]).map((r) => {
    const project = toProject(r);
    const row = latest.get(r.id);
    let summary: ProjectListItem["summary"] = null;
    if (row) {
      const decisions = decisionRows.filter((x) => x.project_id === r.id).map((x): Decision => ({ checkId: x.check_id, status: x.status, note: x.note, decidedBy: x.decided_by, decidedAt: x.decided_at }));
      const plan = buildPlan(contextOf(project), parse<CheckResult[]>(row.results, []), decisions, row.finished_at);
      const ready = readiness(plan);
      summary = {
        blockersDone: ready.blockers.satisfied,
        blockersTotal: ready.blockers.total,
        open: plan.filter((i) => i.status === "open").length,
        launchReady: ready.launchReady,
        readyWithRisks: ready.readyWithRisks,
      };
    }
    return { ...project, lastAssessedAt: row?.finished_at ?? null, summary, pendingApprovals: pending.get(r.id) ?? 0 };
  });
}

export async function getProject(db: D1Database, c: Caller, id: string): Promise<Project | null> {
  const row = await db.prepare("SELECT * FROM projects WHERE id = ? AND owner = ?").bind(id, c.owner).first<ProjectRow>();
  return row ? toProject(row) : null;
}

export async function getProjectDetail(db: D1Database, c: Caller, id: string): Promise<ProjectDetail | null> {
  const project = await getProject(db, c, id);
  if (!project) return null;
  const [a, d, ch] = await db.batch([
    db.prepare("SELECT * FROM assessments WHERE project_id = ? AND finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1").bind(id),
    db.prepare("SELECT * FROM decisions WHERE project_id = ?").bind(id),
    db.prepare("SELECT capability, provider_id FROM provider_choices WHERE project_id = ?").bind(id),
  ]);
  const choices = Object.fromEntries((ch.results as { capability: string; provider_id: string }[]).map((r) => [r.capability, r.provider_id]));
  const row = (a.results as { id: string; started_at: string; finished_at: string | null; sources: string; results: string }[])[0];
  const assessment: Assessment | null = row
    ? { id: row.id, startedAt: row.started_at, finishedAt: row.finished_at, sources: parse<SourceStatus[]>(row.sources, []), results: parse<CheckResult[]>(row.results, []) }
    : null;
  const decisions = (d.results as { check_id: string; status: DecisionStatus; note: string; decided_by: string; decided_at: string }[]).map(
    (r): Decision => ({ checkId: r.check_id, status: r.status, note: r.note, decidedBy: r.decided_by, decidedAt: r.decided_at }),
  );
  return { project, assessment, decisions, choices };
}

export async function createProject(db: D1Database, c: Caller, input: ProjectInput): Promise<Project> {
  const id = crypto.randomUUID();
  const t = now();
  await db.batch([
    db
      .prepare(
        `INSERT INTO projects (id, owner, name, description, repo_url, site_url, product_type, stage, monetization, country, business_type, recheck, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, c.owner, input.name, input.description, input.repoUrl, input.siteUrl, input.productType, input.stage, input.monetization, input.country, input.businessType, input.recheck ? 1 : 0, c.userId, t, t),
    auditStatement(db, c, id, "project.create", id, { name: input.name }),
  ]);
  return (await getProject(db, c, id))!;
}

export async function updateProject(db: D1Database, c: Caller, id: string, input: ProjectInput): Promise<void> {
  await db.batch([
    db
      .prepare(
        `UPDATE projects SET name = ?, description = ?, repo_url = ?, site_url = ?, product_type = ?, stage = ?, monetization = ?, country = ?, business_type = ?, recheck = ?, updated_at = ?
         WHERE id = ? AND owner = ?`,
      )
      .bind(input.name, input.description, input.repoUrl, input.siteUrl, input.productType, input.stage, input.monetization, input.country, input.businessType, input.recheck ? 1 : 0, now(), id, c.owner),
    auditStatement(db, c, id, "project.update", id, input),
  ]);
}

export async function deleteProject(db: D1Database, c: Caller, id: string): Promise<void> {
  // D1 doesn't enforce ON DELETE CASCADE unless foreign keys are on, so delete children explicitly.
  await db.batch([
    db.prepare("DELETE FROM decisions WHERE project_id = ? AND project_id IN (SELECT id FROM projects WHERE owner = ?)").bind(id, c.owner),
    db.prepare("DELETE FROM provider_choices WHERE project_id = ? AND project_id IN (SELECT id FROM projects WHERE owner = ?)").bind(id, c.owner),
    db.prepare("DELETE FROM workflow_runs WHERE project_id = ? AND owner = ?").bind(id, c.owner),
    db.prepare("DELETE FROM notifications WHERE project_id = ? AND owner = ?").bind(id, c.owner),
    db.prepare("DELETE FROM assessments WHERE project_id = ? AND project_id IN (SELECT id FROM projects WHERE owner = ?)").bind(id, c.owner),
    db.prepare("DELETE FROM projects WHERE id = ? AND owner = ?").bind(id, c.owner),
    auditStatement(db, c, id, "project.delete", id, {}),
  ]);
}

/** Start time of the latest assessment, for throttling. */
export async function lastAssessmentStart(db: D1Database, projectId: string): Promise<string | null> {
  return db.prepare("SELECT MAX(started_at) AS t FROM assessments WHERE project_id = ?").bind(projectId).first<string>("t");
}

export async function saveAssessment(
  db: D1Database,
  c: Caller,
  projectId: string,
  a: { startedAt: string; sources: SourceStatus[]; results: CheckResult[]; stack: StackSummary | null },
): Promise<void> {
  const id = crypto.randomUUID();
  const t = now();
  const statements = [
    db
      .prepare("INSERT INTO assessments (id, project_id, started_at, finished_at, sources, results, started_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, projectId, a.startedAt, t, JSON.stringify(a.sources), JSON.stringify(a.results), c.userId),
    auditStatement(db, c, projectId, "assessment.run", id, { sources: a.sources.map((s) => `${s.source}:${s.status}`) }),
  ];
  // Keep the last stack we managed to detect if this run couldn't read the repo.
  if (a.stack) statements.push(db.prepare("UPDATE projects SET stack = ?, updated_at = ? WHERE id = ? AND owner = ?").bind(JSON.stringify(a.stack), t, projectId, c.owner));
  // Bound history: keep the 20 most recent assessments per project.
  statements.push(
    db.prepare("DELETE FROM assessments WHERE project_id = ? AND id NOT IN (SELECT id FROM assessments WHERE project_id = ? ORDER BY started_at DESC LIMIT 20)").bind(projectId, projectId),
  );
  await db.batch(statements);
}

export async function setDecision(db: D1Database, c: Caller, projectId: string, checkId: string, status: DecisionStatus | null, note: string): Promise<void> {
  const t = now();
  const write =
    status === null
      ? db.prepare("DELETE FROM decisions WHERE project_id = ? AND check_id = ?").bind(projectId, checkId)
      : db
          .prepare(
            `INSERT INTO decisions (project_id, check_id, status, note, decided_by, decided_at) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT (project_id, check_id) DO UPDATE SET status = excluded.status, note = excluded.note, decided_by = excluded.decided_by, decided_at = excluded.decided_at`,
          )
          .bind(projectId, checkId, status, note, c.userId, t);
  await db.batch([write, auditStatement(db, c, projectId, status === null ? "decision.clear" : `decision.${status}`, checkId, note ? { note } : {})]);
}

export async function setChoice(db: D1Database, c: Caller, projectId: string, capability: string, providerId: string | null): Promise<void> {
  const write =
    providerId === null
      ? db.prepare("DELETE FROM provider_choices WHERE project_id = ? AND capability = ?").bind(projectId, capability)
      : db
          .prepare(
            `INSERT INTO provider_choices (project_id, capability, provider_id, chosen_by, chosen_at) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (project_id, capability) DO UPDATE SET provider_id = excluded.provider_id, chosen_by = excluded.chosen_by, chosen_at = excluded.chosen_at`,
          )
          .bind(projectId, capability, providerId, c.userId, now());
  await db.batch([write, auditStatement(db, c, projectId, providerId ? "provider.choose" : "provider.clear", capability, providerId ? { providerId } : {})]);
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail: Record<string, unknown>;
  at: string;
}

export async function listAudit(db: D1Database, c: Caller, projectId: string): Promise<AuditEvent[]> {
  const { results } = await db
    .prepare("SELECT id, actor, action, target, detail, at FROM audit_events WHERE project_id = ? AND owner = ? ORDER BY at DESC LIMIT 100")
    .bind(projectId, c.owner)
    .all<{ id: string; actor: string; action: string; target: string; detail: string; at: string }>();
  return results.map((r) => ({ ...r, detail: parse<Record<string, unknown>>(r.detail, {}) }));
}

function auditStatement(db: D1Database, c: Caller, projectId: string | null, action: string, target: string, detail: unknown) {
  return db
    .prepare("INSERT INTO audit_events (id, project_id, owner, actor, action, target, detail, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), projectId, c.owner, c.userId, action, target, JSON.stringify(detail), now());
}
