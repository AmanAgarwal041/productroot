import { NextResponse } from "next/server";
import { handle, requireCaller } from "@/lib/server/auth";
import { listConnections } from "@/lib/server/connections";
import { getDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** GET /api/connections: the workspace's connections (metadata only, never secrets). */
export function GET(req: Request) {
  return handle(async () => {
    const caller = await requireCaller(req);
    return NextResponse.json({ connections: await listConnections(await getDb(), caller.owner), role: caller.role });
  });
}
