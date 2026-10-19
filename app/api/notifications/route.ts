import { NextResponse } from "next/server";
import { handle, requireCaller } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { listNotifications, markAllRead } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const caller = await requireCaller(req);
    return NextResponse.json({ notifications: await listNotifications(await getDb(), caller.owner) });
  });
}

/** POST /api/notifications: mark everything read. */
export function POST(req: Request) {
  return handle(async () => {
    const caller = await requireCaller(req);
    await markAllRead(await getDb(), caller.owner);
    return NextResponse.json({ ok: true });
  });
}
