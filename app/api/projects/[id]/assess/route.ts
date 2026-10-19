import { NextResponse } from "next/server";
import { handle, InputError, requireCaller } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { runAssessment } from "@/lib/server/run-assessment";
import { getProject, getProjectDetail, lastAssessmentStart } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** Shared GitHub/MetaInfo quotas: one run per project per this many seconds. */
const MIN_INTERVAL_S = 30;

/** POST /api/projects/:id/assess: collect evidence and run every check. Read-only towards the user's systems. */
export function POST(req: Request, ctx: RouteContext<"/api/projects/[id]/assess">) {
  return handle(async () => {
    const caller = await requireCaller(req);
    const db = await getDb();
    const { id } = await ctx.params;
    const project = await getProject(db, caller, id);
    if (!project) throw new InputError("Project not found.", 404);

    const last = await lastAssessmentStart(db, id);
    const wait = last ? MIN_INTERVAL_S - Math.floor((Date.now() - Date.parse(last)) / 1000) : 0;
    if (wait > 0) throw new InputError(`An assessment just ran. Try again in ${wait}s.`, 429);

    const { regressions } = await runAssessment(db, caller, project);
    return NextResponse.json({ ...(await getProjectDetail(db, caller, id)), regressions });
  });
}
