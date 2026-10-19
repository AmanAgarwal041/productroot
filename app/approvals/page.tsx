"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RunCard } from "@/components/project/WorkflowsView";
import { api } from "@/lib/client/api";
import type { Project } from "@/lib/core/project";
import type { WorkflowRun } from "@/lib/core/workflow";

export default function ApprovalsPage() {
  const [runs, setRuns] = useState<WorkflowRun[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [role, setRole] = useState("owner");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ runs: WorkflowRun[]; role: string }>("/api/workflows").then(
      (r) => {
        setRuns(r.runs);
        setRole(r.role);
      },
      (e) => setError(e.message),
    );
    api<{ projects: Project[] }>("/api/projects").then((r) => setNames(Object.fromEntries(r.projects.map((p) => [p.id, p.name]))), () => {});
  }, []);

  const upsert = (r: WorkflowRun) => setRuns((rs) => (rs ?? []).map((x) => (x.id === r.id ? r : x)));
  const pending = runs?.filter((r) => r.status === "pending_approval") ?? [];
  const recent = runs?.filter((r) => r.status !== "pending_approval").slice(0, 20) ?? [];

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Approvals</h1>
          <p className="sub">Everything ProductRoot wants to change outside itself waits here for an explicit yes.</p>
        </div>
      </div>
      {error && <div className="notice error">{error}</div>}
      {!runs && !error && <div className="skeleton" style={{ height: 200 }} />}
      {runs && (
        <div className="stack">
          <h2 style={{ fontSize: 15 }}>
            Awaiting approval <span className="muted">{pending.length}</span>
          </h2>
          {pending.length === 0 ? (
            <div className="card empty">
              <h2>Nothing waiting</h2>
              <p>
                Propose pull requests or launch posts from a project&apos;s <Link href="/projects">Workflows</Link> tab.
              </p>
            </div>
          ) : (
            pending.map((r) => (
              <div key={r.id}>
                <RunCard run={r} onChange={upsert} canDecide={role !== "member"} showProject={names[r.projectId]} />
              </div>
            ))
          )}
          {recent.length > 0 && (
            <>
              <h2 style={{ fontSize: 15, marginTop: 16 }}>Recent</h2>
              {recent.map((r) => (
                <RunCard key={r.id} run={r} onChange={upsert} canDecide={role !== "member"} showProject={names[r.projectId]} />
              ))}
            </>
          )}
        </div>
      )}
    </main>
  );
}
