"use client";

import { useMemo, useState } from "react";
import LaunchMap from "../LaunchMap";
import TaskCard, { PRIORITY_LABEL } from "../TaskCard";
import { useProject } from "./context";
import { TaskActions, useChosen } from "./TaskActions";

const SOURCE_NAME = { github: "GitHub", website: "Website", metainfo: "MetaInfo" } as const;

export const ago = (iso: string) => {
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString();
};

function Ring({ value, total }: { value: number; total: number }) {
  const pct = total ? value / total : 1;
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`${value} of ${total} launch blockers covered`}>
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="8" />
      <circle cx="42" cy="42" r={r} fill="none" stroke={pct === 1 ? "var(--pass)" : "var(--accent)"} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 42 42)" />
      <text x="42" y="47" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--text)">
        {total ? Math.round(pct * 100) : 100}%
      </text>
    </svg>
  );
}

export default function Overview() {
  const { detail, plan, ready, links, decide, go } = useProject();
  const chosen = useChosen();
  const [selected, setSelected] = useState<string | null>(null);
  const [now] = useState(Date.now);
  const { assessment, project } = detail;
  const selectedItem = plan.find((i) => i.id === selected) ?? null;
  const next = useMemo(() => plan.filter((i) => i.status === "open" && i.priority !== null && i.blockedBy.length === 0).slice(0, 3), [plan]);
  const left = ready.blockers.total - ready.blockers.satisfied - ready.blockers.skipped;
  const stale = assessment && now - Date.parse(assessment.finishedAt ?? assessment.startedAt) > 7 * 86_400_000;

  if (!assessment)
    return (
      <div className="card empty">
        <h2>Not assessed yet</h2>
        <p>Run an assessment to read your repository and website. Nothing is changed on your side.</p>
      </div>
    );

  return (
    <div className="stack">
      <div className="hero-card">
        <Ring value={ready.blockers.satisfied} total={ready.blockers.total} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className={`badge ${ready.launchReady ? "b-verified" : ready.readyWithRisks ? "b-needs_confirmation" : "b-missing"}`}>
            {ready.launchReady ? "Launch-ready" : ready.readyWithRisks ? "Ready, with accepted risks" : "Not launch-ready"}
          </span>
          <h2 style={{ fontSize: 19, marginTop: 6 }}>
            {ready.launchReady
              ? "Every launch blocker is covered."
              : ready.readyWithRisks
                ? `${ready.blockers.skipped} launch blocker${ready.blockers.skipped === 1 ? " was" : "s were"} skipped. You've accepted the risk.`
                : `${left} launch blocker${left === 1 ? "" : "s"} left before launch.`}
          </h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            {ready.recommended.satisfied}/{ready.recommended.total} recommended covered · {ready.needsConfirmation} waiting for your input · assessed {ago(assessment.finishedAt ?? assessment.startedAt)}
            {project.recheck ? " · re-checked automatically" : ""}
          </p>
        </div>
      </div>

      {stale && <div className="notice">The evidence is more than a week old. Re-assess to make sure it still reflects production.</div>}

      <section className="card" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: "14px 18px 0" }}>
          <h2>Launch map</h2>
          <span className="small muted">Click a step to open it</span>
        </div>
        <div style={{ padding: 12 }}>
          <LaunchMap items={plan} onSelect={(id) => setSelected((s) => (s === id ? null : id))} selectedId={selected} />
        </div>
        {selectedItem && (
          <div style={{ padding: "0 12px 12px" }}>
            <TaskCard key={selectedItem.id} item={selectedItem} links={links} onDecide={decide} defaultOpen extra={<TaskActions item={selectedItem} />} chosen={chosen(selectedItem)} />
          </div>
        )}
      </section>

      <div className="two-col">
        <section className="card">
          <div className="card-head">
            <h2>Next steps</h2>
            <button className="btn btn-sm btn-ghost" style={{ marginLeft: "auto" }} onClick={() => go("plan")}>
              Full plan →
            </button>
          </div>
          {next.length === 0 ? (
            <p className="muted">Nothing actionable right now.</p>
          ) : (
            <ol className="next-list">
              {next.map((i) => (
                <li key={i.id}>
                  <button className="link-btn" onClick={() => setSelected(i.id)}>
                    {i.title}
                  </button>
                  <span className={`badge b-${i.priority}`}>{PRIORITY_LABEL[i.priority!]}</span>
                  <p className="small muted">{i.summary}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Evidence sources</h2>
          </div>
          <div className="sources">
            {assessment.sources.map((src) => (
              <div className="source-row" key={src.source}>
                <span className="name">{SOURCE_NAME[src.source]}</span>
                <span className={`badge ${src.status === "ok" ? "b-verified" : src.status === "error" ? "b-missing" : "b-not_applicable"}`}>{src.status === "ok" ? "Read" : src.status === "error" ? "Failed" : "Skipped"}</span>
                <span className="small muted">{src.message}</span>
              </div>
            ))}
          </div>
          {project.stack && (
            <div className="row" style={{ marginTop: 14 }}>
              {(
                [
                  ["Language", project.stack.languages],
                  ["Framework", project.stack.frameworks],
                  ["Hosting", project.stack.hosting],
                  ["Data", project.stack.databases],
                  ["Auth", project.stack.auth],
                  ["Payments", project.stack.billing],
                ] as const
              )
                .filter(([, v]) => v.length)
                .map(([k, v]) => (
                  <span className="chip" key={k}>
                    <b>{k}</b>
                    {v.join(", ")}
                  </span>
                ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
