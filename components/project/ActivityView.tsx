"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useProject } from "./context";

interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail: Record<string, unknown>;
  at: string;
}

const ACTION_LABEL: Record<string, string> = {
  "project.create": "Created the project",
  "project.update": "Updated project details",
  "assessment.run": "Ran an assessment",
  "decision.done": "Marked done",
  "decision.skipped": "Skipped",
  "decision.not_applicable": "Marked not applicable",
  "decision.clear": "Reopened",
  "provider.choose": "Chose a provider",
  "provider.clear": "Cleared a provider choice",
  "workflow.propose": "Proposed an action",
  "workflow.approve": "Approved",
  "workflow.reject": "Rejected",
  "workflow.cancel": "Cancelled",
  "workflow.retry": "Retried",
  "workflow.succeeded": "Action succeeded",
  "workflow.failed": "Action failed",
};

export default function ActivityView() {
  const { id, detail } = useProject();
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  useEffect(() => {
    api<{ events: AuditEvent[] }>(`/api/projects/${id}/audit`).then((r) => setEvents(r.events), () => setEvents([]));
  }, [id, detail]);
  if (!events) return <p className="muted">Loading…</p>;
  return (
    <div className="card">
      <ol className="timeline">
        {events.map((e) => (
          <li key={e.id}>
            <span className={`tl-dot a-${e.action.split(".")[0]}`} />
            <div>
              <div>
                <strong>{ACTION_LABEL[e.action] ?? e.action}</strong> <span className="mono muted">{e.target.length > 40 ? `${e.target.slice(0, 8)}…` : e.target}</span>
              </div>
              <div className="small muted">
                {new Date(e.at).toLocaleString()} · {e.actor === "system:scheduler" ? "Scheduled re-check" : e.actor === "local-dev" ? "You (local)" : e.actor}
                {typeof e.detail.error === "string" ? ` · ${e.detail.error}` : ""}
                {typeof e.detail.providerId === "string" ? ` · ${e.detail.providerId}` : ""}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {events.length === 0 && <p className="muted">No activity yet.</p>}
    </div>
  );
}
