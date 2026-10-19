"use client";

import { useState, type ReactNode } from "react";
import { CHECK_BY_ID, type Tool } from "@/lib/core/checks";
import type { PlanItem } from "@/lib/core/plan";
import type { CheckState, DecisionStatus, Priority } from "@/lib/core/types";

export const STATE_LABEL: Record<CheckState, string> = {
  verified: "Verified",
  detected: "Detected",
  confirmed: "Confirmed",
  needs_confirmation: "Needs confirmation",
  missing: "Missing",
  not_applicable: "Not applicable",
};
export const PRIORITY_LABEL: Record<Priority, string> = { blocker: "Launch blocker", recommended: "Recommended", optional: "Optional" };
const SOURCE_LABEL = { github: "GitHub", website: "Website", metainfo: "MetaInfo", user: "You", rule: "Rule" } as const;
const EFFORT_LABEL = { minutes: "Minutes", hours: "A few hours", days: "A few days" } as const;

export interface ToolLinks {
  metainfo: string | null;
  socialbrewery: string | null;
}

function ToolHint({ tool, links }: { tool: Tool; links: ToolLinks }) {
  const url = links[tool];
  const name = tool === "metainfo" ? "MetaInfo" : "SocialBrewery";
  return (
    <span className="small">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          Open {name} ↗
        </a>
      ) : (
        <span className="muted">{name} isn&apos;t connected</span>
      )}
    </span>
  );
}

export default function TaskCard({
  item,
  links,
  onDecide,
  extra,
  defaultOpen = false,
  chosen,
}: {
  item: PlanItem;
  links: ToolLinks;
  onDecide: (id: string, status: DecisionStatus | null) => Promise<void>;
  /** Extra actions (compare providers, generate a PR, draft a post). */
  extra?: ReactNode;
  defaultOpen?: boolean;
  /** Name of the provider chosen for this item's capability. */
  chosen?: string | null;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);

  const decide = async (status: DecisionStatus | null) => {
    if (status === "skipped" && item.priority === "blocker" && !window.confirm(`"${item.title}" is a launch blocker.\n\n${item.why}\n\nSkip it anyway and accept the risk?`)) return;
    setBusy(true);
    try {
      await onDecide(item.id, status);
    } finally {
      setBusy(false);
    }
  };
  const metainfoReport = item.evidence.find((e) => e.source === "metainfo" && e.ref.startsWith("http"))?.ref;

  return (
    <div className="task" open-state={open ? "1" : "0"}>
      <button className="task-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <svg className="chev" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="task-title">
          {item.title}
          <span className="muted">{item.reopened ? "Reopened: the latest scan found this missing. " : ""}{item.summary}</span>
        </span>
        {chosen && <span className="badge plain" title="Chosen provider">{chosen}</span>}
        {item.status === "skipped" && <span className="badge plain">Skipped</span>}
        {item.blockedBy.length > 0 && item.status === "open" && <span className="badge plain">Waiting on prerequisite</span>}
        <span className={`badge b-${item.state}`}>{STATE_LABEL[item.state]}</span>
      </button>
      {open && (
        <div className="task-body">
          <div className="task-cols">
            <div>
              <h4>Why it matters</h4>
              <p>{item.why}</p>
            </div>
            <div>
              <h4>Recommended approach</h4>
              <p>{item.recommendation}</p>
            </div>
          </div>

          {item.state === "needs_confirmation" && item.status === "open" && (
            <div className="notice info">
              <strong>We couldn&apos;t tell from the evidence.</strong> {item.question}
            </div>
          )}

          <div>
            <h4>Evidence</h4>
            {item.evidence.length ? (
              <ul className="evidence">
                {item.evidence.map((e, i) => (
                  <li key={i}>
                    <span className="src">{SOURCE_LABEL[e.source]}</span>
                    <span>
                      {e.detail}
                      {e.ref && (
                        <>
                          {" · "}
                          <span className="ref">{e.ref}</span>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">No direct evidence. {item.decision ? `Marked ${item.decision.status.replace("_", " ")} by you on ${new Date(item.decision.decidedAt).toLocaleDateString()}.` : ""}</p>
            )}
          </div>

          <div className="task-cols">
            <div>
              <h4>How to verify</h4>
              <p className="small">{item.verify}</p>
            </div>
            <div>
              <h4>Effort and help</h4>
              <div className="row small">
                <span>{EFFORT_LABEL[item.effort]}</span>
                <span className="muted">· Guided</span>
                {item.tools.map((t) => (
                  <ToolHint key={t} tool={t} links={t === "metainfo" && metainfoReport ? { ...links, metainfo: metainfoReport } : links} />
                ))}
              </div>
            </div>
          </div>

          {item.blockedBy.length > 0 && (
            <p className="small muted">Do this after: {item.blockedBy.map((id) => CHECK_BY_ID[id]?.title ?? id).join(", ")}.</p>
          )}

          <div className="task-actions">
            {extra}
            {item.decision || item.status === "skipped" ? (
              <button className="btn btn-sm" disabled={busy} onClick={() => decide(null)}>
                Reopen
              </button>
            ) : null}
            {item.status !== "done" && item.state !== "verified" && (
              <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => decide("done")}>
                It&apos;s done
              </button>
            )}
            {item.status === "open" && (
              <button className="btn btn-sm" disabled={busy} onClick={() => decide("skipped")}>
                Skip for now
              </button>
            )}
            {item.status !== "not_applicable" && (
              <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => decide("not_applicable")}>
                Not applicable
              </button>
            )}
            {item.status === "done" && item.state !== "verified" && item.state !== "confirmed" && <span className="small muted">Found automatically. Confirm by testing it.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
