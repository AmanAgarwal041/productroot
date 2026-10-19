"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Project } from "@/lib/core/project";
import { MONETIZATION_LABEL, PRODUCT_TYPE_LABEL, STAGE_LABEL } from "@/lib/core/types";

type Item = Project & {
  lastAssessedAt: string | null;
  summary: { blockersDone: number; blockersTotal: number; open: number; launchReady: boolean; readyWithRisks: boolean } | null;
  pendingApprovals: number;
};

function Status({ s }: { s: Item["summary"] }) {
  if (!s) return <span className="badge b-not_applicable">Not assessed</span>;
  if (s.launchReady) return <span className="badge b-verified">Launch-ready</span>;
  if (s.readyWithRisks) return <span className="badge b-needs_confirmation">Ready with risks</span>;
  return <span className="badge b-missing">{s.blockersTotal - s.blockersDone} blocker{s.blockersTotal - s.blockersDone === 1 ? "" : "s"} left</span>;
}

export default function ProjectsPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<{ message: string; status: number } | null>(null);

  useEffect(() => {
    api<{ projects: Item[] }>("/api/projects").then(
      (r) => setItems(r.projects),
      (e) => setError({ message: e.message, status: e instanceof ApiError ? e.status : 0 }),
    );
  }, []);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="sub">Each project is one product you&apos;re taking to launch.</p>
        </div>
        <div className="actions">
          <Link className="btn btn-primary" href="/projects/new">
            New project
          </Link>
        </div>
      </div>
      {error && (
        <div className="notice error">
          {error.message} {error.status === 401 && <Link href="/login">Sign in</Link>}
        </div>
      )}
      {!items && !error && (
        <div className="project-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 150 }} />
          ))}
        </div>
      )}
      {items && items.length === 0 && (
        <div className="card empty">
          <h2>No projects yet</h2>
          <p>Add a repository or website to get your first readiness assessment.</p>
          <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
            <Link className="btn btn-primary" href="/projects/new">
              Check my product readiness
            </Link>
          </div>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="project-grid">
          {items.map((p) => {
            const s = p.summary;
            const pct = s && s.blockersTotal ? (s.blockersDone / s.blockersTotal) * 100 : s ? 100 : 0;
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="project-card">
                <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                  <strong className="project-name">{p.name}</strong>
                  <Status s={s} />
                </div>
                <div className="small muted">
                  {PRODUCT_TYPE_LABEL[p.productType]} · {STAGE_LABEL[p.stage]} · {MONETIZATION_LABEL[p.monetization]}
                </div>
                <div>
                  <div className="row small" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Launch blockers</span>
                    <span className="num">{s ? `${s.blockersDone}/${s.blockersTotal}` : "–"}</span>
                  </div>
                  <div className={`meter${s?.launchReady ? " pass" : ""}`}>
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="row small muted" style={{ marginTop: "auto" }}>
                  {p.stack?.frameworks.length ? <span className="chip">{p.stack.frameworks.join(", ")}</span> : null}
                  {s && <span>{s.open} open</span>}
                  {p.pendingApprovals > 0 && <span className="badge b-needs_confirmation">{p.pendingApprovals} awaiting approval</span>}
                  <span style={{ marginLeft: "auto" }}>{p.lastAssessedAt ? new Date(p.lastAssessedAt).toLocaleDateString() : ""}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
