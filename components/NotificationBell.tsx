"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";

interface Notification {
  id: string;
  projectId: string | null;
  kind: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

const KIND_ICON: Record<string, string> = { regression: "↓", recheck_failed: "!", approval_needed: "◆", workflow_failed: "✕", workflow_succeeded: "✓" };

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => api<{ notifications: Notification[] }>("/api/notifications").then((r) => setItems(r.notifications), () => {}), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="bell" ref={ref}>
      <button
        className="btn btn-ghost bell-btn"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unread) api("/api/notifications", { method: "POST" }).then(load, () => {});
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="bell-dot">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Notifications">
          <div className="popover-head">
            <strong>Notifications</strong>
          </div>
          {items.length === 0 && <p className="small muted" style={{ padding: 14 }}>Nothing yet. Regressions from scheduled re-checks and approvals will show up here.</p>}
          {items.map((n) => (
            <Link key={n.id} href={n.projectId ? `/projects/${n.projectId}${n.kind.startsWith("workflow") || n.kind === "approval_needed" ? "?view=workflows" : ""}` : "/projects"} className={`notif${n.readAt ? "" : " unread"}`} onClick={() => setOpen(false)}>
              <span className="small">
                <span aria-hidden="true">{KIND_ICON[n.kind] ?? "•"} </span>
                <strong>{n.title}</strong>
              </span>
              {n.body && <span className="small muted">{n.body.slice(0, 160)}</span>}
              <span className="small muted">{new Date(n.createdAt).toLocaleString()}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
