// In-app notifications (approvals needed, regressions, failed runs).

export type NotificationKind = "regression" | "recheck_failed" | "approval_needed" | "workflow_failed" | "workflow_succeeded";

export interface Notification {
  id: string;
  projectId: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function notifyStatement(db: D1Database, owner: string, projectId: string | null, kind: NotificationKind, title: string, body = "") {
  return db
    .prepare("INSERT INTO notifications (id, owner, project_id, kind, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), owner, projectId, kind, title.slice(0, 200), body.slice(0, 1000), new Date().toISOString());
}

export async function listNotifications(db: D1Database, owner: string): Promise<Notification[]> {
  const { results } = await db
    .prepare("SELECT id, project_id, kind, title, body, read_at, created_at FROM notifications WHERE owner = ? ORDER BY created_at DESC LIMIT 50")
    .bind(owner)
    .all<{ id: string; project_id: string | null; kind: NotificationKind; title: string; body: string; read_at: string | null; created_at: string }>();
  return results.map((r) => ({ id: r.id, projectId: r.project_id, kind: r.kind, title: r.title, body: r.body, readAt: r.read_at, createdAt: r.created_at }));
}

export async function markAllRead(db: D1Database, owner: string): Promise<void> {
  await db.prepare("UPDATE notifications SET read_at = ? WHERE owner = ? AND read_at IS NULL").bind(new Date().toISOString(), owner).run();
}
