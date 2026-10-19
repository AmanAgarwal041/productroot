import { NextResponse } from "next/server";
import type { Project } from "@/lib/core/project";
import { getDb } from "@/lib/server/db";
import { notifyStatement } from "@/lib/server/notify";
import { runAssessment } from "@/lib/server/run-assessment";
import { getProject } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** Re-assess projects whose evidence is older than this. */
const RECHECK_HOURS = 24;
/** Per invocation, to stay inside Workers subrequest limits (~10 subrequests per assessment). */
const BATCH = 3;

function sameSecret(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * POST /api/cron/recheck: called by the Worker's scheduled handler (worker.ts)
 * with the CRON_SECRET header. Re-assesses the stalest opted-in projects and
 * notifies their workspaces about regressions or failures.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!sameSecret(req.headers.get("x-cron-secret") ?? "", secret)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const db = await getDb();
  const cutoff = new Date(Date.now() - RECHECK_HOURS * 3_600_000).toISOString();
  const { results } = await db
    .prepare(
      `SELECT p.id, p.owner, (SELECT MAX(started_at) FROM assessments a WHERE a.project_id = p.id) AS last
       FROM projects p WHERE p.recheck = 1 AND (p.repo_url IS NOT NULL OR p.site_url IS NOT NULL)
       AND COALESCE((SELECT MAX(started_at) FROM assessments a WHERE a.project_id = p.id), '') < ?
       ORDER BY last IS NOT NULL, last ASC LIMIT ?`,
    )
    .bind(cutoff, BATCH)
    .all<{ id: string; owner: string }>();

  const report: { projectId: string; ok: boolean; regressions?: number; error?: string }[] = [];
  for (const row of results) {
    const caller = { userId: "system:scheduler", owner: row.owner, role: "owner" as const };
    const project = (await getProject(db, caller, row.id)) as Project;
    try {
      const { regressions } = await runAssessment(db, caller, project);
      report.push({ projectId: row.id, ok: true, regressions: regressions.length });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await notifyStatement(db, row.owner, row.id, "recheck_failed", `${project.name}: scheduled re-check failed`, error).run();
      report.push({ projectId: row.id, ok: false, error });
    }
  }
  return NextResponse.json({ checked: report.length, report });
}
