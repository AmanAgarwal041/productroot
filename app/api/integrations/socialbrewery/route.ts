import { NextResponse } from "next/server";
import { handle, InputError, requireCaller } from "@/lib/server/auth";
import { getConnection } from "@/lib/server/connections";
import { getDb } from "@/lib/server/db";
import { socialbreweryTools } from "@/lib/server/integrations/socialbrewery";

export const dynamic = "force-dynamic";

/** GET /api/integrations/socialbrewery: the connector's tools with input schemas (read-only discovery). */
export function GET(req: Request) {
  return handle(async () => {
    const caller = await requireCaller(req);
    const conn = await getConnection(await getDb(), caller.owner, "socialbrewery");
    if (!conn) throw new InputError("SocialBrewery isn't connected.", 404);
    return NextResponse.json(await socialbreweryTools({ url: String(conn.meta.url), token: conn.secret }));
  });
}
