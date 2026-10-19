import { NextResponse } from "next/server";
import { CHECK_BY_ID } from "@/lib/core/checks";
import type { DecisionStatus } from "@/lib/core/types";
import { handle, InputError, requireCaller } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { getProject, getProjectDetail, setDecision } from "@/lib/server/store";

export const dynamic = "force-dynamic";

const STATUSES: DecisionStatus[] = ["done", "skipped", "not_applicable"];

/**
 * PUT /api/projects/:id/decisions { checkId, status: "done" | "skipped" | "not_applicable" | null, note? }
 * Records the user's decision on a task. `null` clears it (reopen). "done" means
 * user-confirmed, never verified.
 */
export function PUT(req: Request, ctx: RouteContext<"/api/projects/[id]/decisions">) {
  return handle(async () => {
    const caller = await requireCaller(req);
    const db = await getDb();
    const { id } = await ctx.params;
    if (!(await getProject(db, caller, id))) throw new InputError("Project not found.", 404);
    const body = (await req.json().catch(() => null)) as { checkId?: unknown; status?: unknown; note?: unknown } | null;
    const checkId = typeof body?.checkId === "string" ? body.checkId : "";
    if (!CHECK_BY_ID[checkId]) throw new InputError("Unknown check.");
    const status = body?.status === null ? null : STATUSES.includes(body?.status as DecisionStatus) ? (body!.status as DecisionStatus) : undefined;
    if (status === undefined) throw new InputError("Status must be done, skipped, not_applicable or null.");
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";
    await setDecision(db, caller, id, checkId, status, note);
    return NextResponse.json(await getProjectDetail(db, caller, id));
  });
}
