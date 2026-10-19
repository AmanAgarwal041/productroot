import { NextResponse } from "next/server";
import { handle, requireCaller } from "@/lib/server/auth";
import { listConnections } from "@/lib/server/connections";
import { getDb } from "@/lib/server/db";
import { allIntegrations } from "@/lib/server/integrations";

export const dynamic = "force-dynamic";

/** GET /api/integrations: each adapter's configuration and honest capability matrix for this workspace. */
export function GET(req: Request) {
  return handle(async () => {
    const caller = await requireCaller(req);
    const connections = await listConnections(await getDb(), caller.owner);
    return NextResponse.json({ integrations: allIntegrations(connections), connections, role: caller.role });
  });
}
