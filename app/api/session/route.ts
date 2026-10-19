import { NextResponse } from "next/server";
import { clerkEnabled, currentCaller, devUserEnabled } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** GET /api/session: whether sign-in is set up and who is calling. */
export async function GET(req: Request) {
  const caller = await currentCaller(req);
  return NextResponse.json({ authEnabled: clerkEnabled(), devUser: devUserEnabled(), authenticated: !!caller, owner: caller?.owner ?? null });
}
