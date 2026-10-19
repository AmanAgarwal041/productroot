import { NextResponse } from "next/server";
import { CAPABILITIES, type Capability } from "@/lib/core/catalog";
import { CATALOG } from "@/lib/core/catalog-data";
import { handle, InputError, requireCaller } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { getProject, getProjectDetail, setChoice } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** PUT /api/projects/:id/choices { capability, providerId | null }: record the chosen provider. */
export function PUT(req: Request, ctx: RouteContext<"/api/projects/[id]/choices">) {
  return handle(async () => {
    const caller = await requireCaller(req);
    const db = await getDb();
    const { id } = await ctx.params;
    if (!(await getProject(db, caller, id))) throw new InputError("Project not found.", 404);
    const body = (await req.json().catch(() => null)) as { capability?: unknown; providerId?: unknown } | null;
    const capability = body?.capability as Capability;
    if (!CAPABILITIES.includes(capability)) throw new InputError("Unknown capability.");
    const providerId = body?.providerId === null ? null : String(body?.providerId ?? "");
    if (providerId !== null && !CATALOG.some((p) => p.id === providerId && p.capability === capability)) throw new InputError("Unknown provider for this capability.");
    await setChoice(db, caller, id, capability, providerId);
    return NextResponse.json(await getProjectDetail(db, caller, id));
  });
}
