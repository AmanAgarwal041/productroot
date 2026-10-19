import { NextResponse } from "next/server";
import { validateProjectInput } from "@/lib/core/project";
import { handle, InputError, requireCaller } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { deleteProject, getProject, getProjectDetail, updateProject } from "@/lib/server/store";

export const dynamic = "force-dynamic";

const notFound = () => new InputError("Project not found.", 404);

/** GET /api/projects/:id: project, latest assessment and decisions. */
export function GET(req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  return handle(async () => {
    const caller = await requireCaller(req);
    const detail = await getProjectDetail(await getDb(), caller, (await ctx.params).id);
    if (!detail) throw notFound();
    return NextResponse.json(detail);
  });
}

/** PATCH /api/projects/:id: update context fields. Priorities are recomputed on read; no re-scan needed. */
export function PATCH(req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  return handle(async () => {
    const caller = await requireCaller(req);
    const db = await getDb();
    const { id } = await ctx.params;
    const current = await getProject(db, caller, id);
    if (!current) throw notFound();
    const v = validateProjectInput(await req.json().catch(() => null), current);
    if (!v.ok) throw new InputError(v.error);
    await updateProject(db, caller, id, v.value);
    return NextResponse.json(await getProjectDetail(db, caller, id));
  });
}

/** DELETE /api/projects/:id: remove the project, its assessments and decisions. */
export function DELETE(req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  return handle(async () => {
    const caller = await requireCaller(req);
    if (caller.role === "member") throw new InputError("Only admins can delete projects.", 403);
    const db = await getDb();
    const { id } = await ctx.params;
    if (!(await getProject(db, caller, id))) throw notFound();
    await deleteProject(db, caller, id);
    return NextResponse.json({ ok: true });
  });
}
