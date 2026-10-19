import { NextResponse } from "next/server";
import type { RunAction } from "@/lib/core/workflow";
import { handle, InputError, requireCaller } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { act, getRun, refreshRun } from "@/lib/server/workflows";

export const dynamic = "force-dynamic";

const ACTIONS: (RunAction | "refresh")[] = ["approve", "reject", "cancel", "retry", "refresh"];

export function GET(req: Request, ctx: RouteContext<"/api/workflows/[runId]">) {
  return handle(async () => {
    const caller = await requireCaller(req);
    const run = await getRun(await getDb(), caller.owner, (await ctx.params).runId);
    if (!run) throw new InputError("Workflow run not found.", 404);
    return NextResponse.json({ run });
  });
}

/** POST /api/workflows/:id { action: approve | reject | cancel | retry | refresh }. Approve executes the action once. */
export function POST(req: Request, ctx: RouteContext<"/api/workflows/[runId]">) {
  return handle(async () => {
    const caller = await requireCaller(req);
    const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
    const action = body?.action as RunAction | "refresh";
    if (!ACTIONS.includes(action)) throw new InputError("Unknown action.");
    const db = await getDb();
    const { runId } = await ctx.params;
    const run = action === "refresh" ? await refreshRun(db, caller, runId) : await act(db, caller, runId, action);
    return NextResponse.json({ run });
  });
}
