import { NextResponse } from "next/server";
import { handle, InputError, requireCaller } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { getProject } from "@/lib/server/store";
import { listRuns, proposePullRequest, proposeSocialPost } from "@/lib/server/workflows";

export const dynamic = "force-dynamic";

/** GET /api/projects/:id/workflows: runs, newest first. */
export function GET(req: Request, ctx: RouteContext<"/api/projects/[id]/workflows">) {
  return handle(async () => {
    const caller = await requireCaller(req);
    return NextResponse.json({ runs: await listRuns(await getDb(), caller.owner, (await ctx.params).id) });
  });
}

/**
 * POST /api/projects/:id/workflows: propose an action. Nothing executes until approved.
 * { kind: "pull_request", checkIds: string[], params?: { [checkId]: { [key]: string } } }
 * { kind: "social_post", tool: string, args: { ... } }
 */
export function POST(req: Request, ctx: RouteContext<"/api/projects/[id]/workflows">) {
  return handle(async () => {
    const caller = await requireCaller(req);
    const db = await getDb();
    const project = await getProject(db, caller, (await ctx.params).id);
    if (!project) throw new InputError("Project not found.", 404);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (body?.kind === "pull_request") {
      const ids = Array.isArray(body.checkIds) ? body.checkIds.filter((x): x is string => typeof x === "string").slice(0, 10) : [];
      const params = body.params && typeof body.params === "object" ? (body.params as Record<string, Record<string, string>>) : {};
      return NextResponse.json({ run: await proposePullRequest(db, caller, project, ids, params) }, { status: 201 });
    }
    if (body?.kind === "social_post") {
      const args = body.args && typeof body.args === "object" ? (body.args as Record<string, unknown>) : {};
      return NextResponse.json({ run: await proposeSocialPost(db, caller, project, String(body.tool ?? ""), args) }, { status: 201 });
    }
    throw new InputError("Unknown workflow kind.");
  });
}
