import { NextResponse } from "next/server";
import { normalizeSiteUrl } from "@/lib/core/urls";
import { handle, InputError, requireCaller } from "@/lib/server/auth";
import { CONNECTION_PROVIDERS, deleteConnection, saveConnection, type ConnectionProvider } from "@/lib/server/connections";
import { getDb } from "@/lib/server/db";
import { GithubError } from "@/lib/server/collect/github";
import { verifyGithubToken } from "@/lib/server/github-pr";
import { socialbreweryTools } from "@/lib/server/integrations/socialbrewery";
import { verifyUptimeKey } from "@/lib/server/integrations/uptime";
import { assertPublic } from "@/lib/server/safe-fetch";

export const dynamic = "force-dynamic";

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function providerOf(p: string): ConnectionProvider {
  if (!CONNECTION_PROVIDERS.includes(p as ConnectionProvider)) throw new InputError("Unknown provider.", 404);
  return p as ConnectionProvider;
}

/**
 * PUT /api/connections/:provider: validate the credential with the provider, then store it encrypted.
 * github { token } · socialbrewery { url, token } · uptimerobot | betterstack { apiKey }
 */
export function PUT(req: Request, ctx: RouteContext<"/api/connections/[provider]">) {
  return handle(async () => {
    const caller = await requireCaller(req);
    if (caller.role === "member") throw new InputError("Only workspace admins can connect services.", 403);
    const provider = providerOf((await ctx.params).provider);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const db = await getDb();

    if (provider === "github") {
      const token = str(body.token, 300);
      if (!/^(github_pat_|ghp_|gho_|ghu_)[A-Za-z0-9_]{20,}$/.test(token)) throw new InputError("That doesn't look like a GitHub token.");
      const { login } = await verifyGithubToken(token).catch((e) => {
        throw new InputError(e instanceof GithubError && e.status !== 404 && /rejected/.test(e.message) ? "GitHub rejected this token. Check it was copied in full and hasn't expired." : e instanceof Error ? e.message : "GitHub rejected the token.");
      });
      await saveConnection(db, caller, provider, token, { login, kind: token.startsWith("github_pat_") ? "fine-grained" : "classic" });
    } else if (provider === "socialbrewery") {
      const url = normalizeSiteUrl(str(body.url));
      const token = str(body.token, 300);
      if (!url) throw new InputError("Enter your SocialBrewery URL.");
      if (!token) throw new InputError("Enter the connector token from SocialBrewery → Connectors.");
      await assertPublic(new URL(url)).catch((e) => {
        throw new InputError(e instanceof Error ? e.message : "That URL can't be used.");
      });
      const origin = new URL(url).origin;
      const tools = await socialbreweryTools({ url: origin, token });
      if (!tools.ok) throw new InputError(tools.error);
      await saveConnection(db, caller, provider, token, { url: origin, tools: tools.data.length });
    } else {
      const apiKey = str(body.apiKey, 300);
      if (!apiKey) throw new InputError("Enter an API key.");
      const r = await verifyUptimeKey(provider, apiKey);
      if (!r.ok) throw new InputError(r.error);
      await saveConnection(db, caller, provider, apiKey, { monitors: r.data.length });
    }
    return NextResponse.json({ ok: true });
  });
}

/** DELETE /api/connections/:provider: forget the credential (revoke it at the provider too). */
export function DELETE(req: Request, ctx: RouteContext<"/api/connections/[provider]">) {
  return handle(async () => {
    const caller = await requireCaller(req);
    if (caller.role === "member") throw new InputError("Only workspace admins can disconnect services.", 403);
    await deleteConnection(await getDb(), caller, providerOf((await ctx.params).provider));
    return NextResponse.json({ ok: true });
  });
}
