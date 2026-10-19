// Per-workspace provider connections. Credentials are validated against the
// provider before being stored (the contract's "connect" step), sealed with
// secrets.ts, and can be removed at any time ("disconnect"). Only non-secret
// metadata is ever returned to the browser.

import { open, seal } from "./secrets";
import type { Caller } from "./auth";

export const CONNECTION_PROVIDERS = ["github", "socialbrewery", "uptimerobot", "betterstack"] as const;
export type ConnectionProvider = (typeof CONNECTION_PROVIDERS)[number];

export interface ConnectionInfo {
  provider: ConnectionProvider;
  meta: Record<string, unknown>;
  status: "ok" | "error";
  statusMessage: string;
  connectedBy: string;
  connectedAt: string;
  checkedAt: string | null;
}

const aad = (owner: string, provider: string) => `productroot:${owner}:${provider}`;

interface Row {
  provider: ConnectionProvider;
  secret: string;
  meta: string;
  status: "ok" | "error";
  status_message: string;
  connected_by: string;
  connected_at: string;
  checked_at: string | null;
}

const info = (r: Row): ConnectionInfo => ({
  provider: r.provider,
  meta: JSON.parse(r.meta || "{}") as Record<string, unknown>,
  status: r.status,
  statusMessage: r.status_message,
  connectedBy: r.connected_by,
  connectedAt: r.connected_at,
  checkedAt: r.checked_at,
});

export async function listConnections(db: D1Database, owner: string): Promise<ConnectionInfo[]> {
  const { results } = await db.prepare("SELECT * FROM connections WHERE owner = ?").bind(owner).all<Row>();
  return results.map(info);
}

export async function getConnection(db: D1Database, owner: string, provider: ConnectionProvider): Promise<(ConnectionInfo & { secret: string }) | null> {
  const r = await db.prepare("SELECT * FROM connections WHERE owner = ? AND provider = ?").bind(owner, provider).first<Row>();
  if (!r) return null;
  return { ...info(r), secret: await open(r.secret, aad(owner, provider)) };
}

export async function saveConnection(db: D1Database, c: Caller, provider: ConnectionProvider, secret: string, meta: Record<string, unknown>): Promise<void> {
  const t = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO connections (owner, provider, secret, meta, status, status_message, connected_by, connected_at, checked_at) VALUES (?, ?, ?, ?, 'ok', '', ?, ?, ?)
         ON CONFLICT (owner, provider) DO UPDATE SET secret = excluded.secret, meta = excluded.meta, status = 'ok', status_message = '', connected_by = excluded.connected_by, connected_at = excluded.connected_at, checked_at = excluded.checked_at`,
      )
      .bind(c.owner, provider, await seal(secret, aad(c.owner, provider)), JSON.stringify(meta), c.userId, t, t),
    workspaceAudit(db, c, "connection.connect", provider, meta),
  ]);
}

export async function markConnection(db: D1Database, owner: string, provider: ConnectionProvider, ok: boolean, message: string): Promise<void> {
  await db.prepare("UPDATE connections SET status = ?, status_message = ?, checked_at = ? WHERE owner = ? AND provider = ?").bind(ok ? "ok" : "error", message.slice(0, 300), new Date().toISOString(), owner, provider).run();
}

export async function deleteConnection(db: D1Database, c: Caller, provider: ConnectionProvider): Promise<void> {
  await db.batch([db.prepare("DELETE FROM connections WHERE owner = ? AND provider = ?").bind(c.owner, provider), workspaceAudit(db, c, "connection.disconnect", provider, {})]);
}

function workspaceAudit(db: D1Database, c: Caller, action: string, target: string, detail: unknown) {
  return db
    .prepare("INSERT INTO audit_events (id, project_id, owner, actor, action, target, detail, at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), c.owner, c.userId, action, target, JSON.stringify(detail), new Date().toISOString());
}
