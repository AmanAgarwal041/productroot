// Assess a project with the workspace's connections, save it, and notify on
// regressions. Shared by the manual "Assess" route and scheduled re-checks.

import type { Project } from "@/lib/core/project";
import { findRegressions, type Regression } from "@/lib/core/regressions";
import type { CheckResult } from "@/lib/core/types";
import { assess } from "./assess";
import type { Caller } from "./auth";
import { getConnection, markConnection } from "./connections";
import { notifyStatement } from "./notify";
import { saveAssessment } from "./store";

export async function runAssessment(db: D1Database, caller: Caller, project: Project): Promise<{ regressions: Regression[] }> {
  const prevRow = await db
    .prepare("SELECT results FROM assessments WHERE project_id = ? AND finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1")
    .bind(project.id)
    .first<{ results: string }>();
  const [github, robot, better] = await Promise.all(
    (["github", "uptimerobot", "betterstack"] as const).map((p) => getConnection(db, caller.owner, p).catch(() => null)),
  );
  const uptimeConn = robot ? { provider: "uptimerobot" as const, key: robot.secret } : better ? { provider: "betterstack" as const, key: better.secret } : null;
  const startedAt = new Date().toISOString();
  const outcome = await assess(project, { githubToken: github?.secret ?? null, uptime: uptimeConn });

  // Surface a broken GitHub token on the connection itself, not just in this run.
  const ghSource = outcome.sources.find((s) => s.source === "github");
  if (github && ghSource) await markConnection(db, caller.owner, "github", ghSource.status !== "error" || !/token/i.test(ghSource.message), ghSource.status === "error" ? ghSource.message : "");

  await saveAssessment(db, caller, project.id, { startedAt, ...outcome });
  const regressions = findRegressions(prevRow ? (JSON.parse(prevRow.results) as CheckResult[]) : null, outcome.results);
  if (regressions.length)
    await db.batch(
      regressions.map((r) => notifyStatement(db, caller.owner, project.id, "regression", `${project.name}: ${r.title} regressed`, `Was ${r.before}, now missing. ${r.summary}`)),
    );
  return { regressions };
}
