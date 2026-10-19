import { NextResponse } from "next/server";
import { handle, requireCaller } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { listAudit } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** GET /api/projects/:id/audit: the project's activity log, newest first. */
export function GET(req: Request, ctx: RouteContext<"/api/projects/[id]/audit">) {
  return handle(async () => {
    const caller = await requireCaller(req);
    return NextResponse.json({ events: await listAudit(await getDb(), caller, (await ctx.params).id) });
  });
}
