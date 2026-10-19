import { NextResponse } from "next/server";
import { handle, requireCaller } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { listRuns } from "@/lib/server/workflows";

export const dynamic = "force-dynamic";

/** GET /api/workflows: all runs in the workspace (the approvals inbox). */
export function GET(req: Request) {
  return handle(async () => {
    const caller = await requireCaller(req);
    return NextResponse.json({ runs: await listRuns(await getDb(), caller.owner), role: caller.role });
  });
}
