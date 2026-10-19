// Who is calling. Sign-in runs on Clerk, verified per request exactly as in
// MetaInfo (lib/server/auth/clerk.ts there): the browser sends Clerk's
// short-lived session token as the __session cookie or a Bearer header.
// Using the same Clerk application as MetaInfo and SocialBrewery gives one
// sign-in across the product family.
//
// Without Clerk keys, `next dev` runs as a single local user so the product
// can be tried immediately; production refuses instead.

import { verifyToken } from "@clerk/backend";
import { NextResponse } from "next/server";

const env = (k: string) => process.env[k]?.trim() || "";

export const clerkEnabled = () => !!(env("CLERK_SECRET_KEY") || env("CLERK_JWT_KEY"));
export const devUserEnabled = () => !clerkEnabled() && process.env.NODE_ENV !== "production";

export type { Role } from "@/lib/core/roles";
import type { Role } from "@/lib/core/roles";

export interface Caller {
  userId: string;
  /** Workspace the caller is acting in: the active Clerk organisation, or their own user id. */
  owner: string;
  role: Role;
}

export class AuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
  }
}

function tokenFrom(req: Request): string | null {
  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  if (bearer) return bearer;
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === "__session") return v.join("=") || null;
  }
  return null;
}

const appRole = (r: string | undefined): Role => {
  const name = (r ?? "").replace(/^org:/, "");
  return name === "owner" || name === "admin" ? name : "member";
};

export async function currentCaller(req: Request): Promise<Caller | null> {
  if (devUserEnabled()) return { userId: "local-dev", owner: "local-dev", role: "owner" };
  const token = tokenFrom(req);
  if (!token || !clerkEnabled()) return null;
  const parties = [new URL(req.url).origin, env("APP_URL").replace(/\/+$/, "")].filter(Boolean);
  try {
    const claims = await verifyToken(token, {
      secretKey: env("CLERK_SECRET_KEY") || undefined,
      jwtKey: env("CLERK_JWT_KEY") || undefined,
      authorizedParties: parties,
    });
    if (!claims.sub || claims.sts === "pending") return null;
    const org = claims.v === 2 ? { id: claims.o?.id, rol: claims.o?.rol } : { id: claims.org_id, rol: claims.org_role };
    return org.id ? { userId: claims.sub, owner: org.id, role: appRole(org.rol) } : { userId: claims.sub, owner: claims.sub, role: "owner" };
  } catch {
    return null;
  }
}

/** Refuse cross-site state-changing requests (defence in depth on top of SameSite cookies). */
export function assertSameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw new AuthError("Cross-site request refused.", 403);
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin && origin !== env("APP_URL").replace(/\/+$/, "")) throw new AuthError("Cross-site request refused.", 403);
}

export async function requireCaller(req: Request): Promise<Caller> {
  assertSameOrigin(req);
  const c = await currentCaller(req);
  if (!c) throw new AuthError(clerkEnabled() ? "Sign in to continue." : "Sign-in isn't configured on this server.", 401);
  return c;
}

export class InputError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** JSON error responses for known errors, 500 for anything else. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError || e instanceof InputError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
