"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ActivityView from "@/components/project/ActivityView";
import { ProjectContext, type Connection, type ProjectCtx, type View } from "@/components/project/context";
import Overview from "@/components/project/Overview";
import PlanView from "@/components/project/PlanView";
import ProvidersView from "@/components/project/ProvidersView";
import SettingsView from "@/components/project/SettingsView";
import WorkflowsView from "@/components/project/WorkflowsView";
import type { ToolLinks } from "@/components/TaskCard";
import { api } from "@/lib/client/api";
import { buildPlan, readiness } from "@/lib/core/plan";
import { contextOf, type ProjectDetail } from "@/lib/core/project";
import { BUSINESS_TYPE_LABEL, MONETIZATION_LABEL, PRODUCT_TYPE_LABEL, STAGE_LABEL, type DecisionStatus } from "@/lib/core/types";

const VIEWS: [View, string][] = [
  ["overview", "Overview"],
  ["plan", "Plan"],
  ["providers", "Providers"],
  ["workflows", "Workflows"],
  ["activity", "Activity"],
  ["settings", "Settings"],
];

function Toasts({ items }: { items: { id: number; message: string; tone: "ok" | "error" }[] }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view = (params.get("view") as View) || "overview";

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [links, setLinks] = useState<ToolLinks>({ metainfo: null, socialbrewery: null });
  const [connections, setConnections] = useState<Connection[]>([]);
  const [role, setRole] = useState<ProjectCtx["role"]>("owner");
  const [error, setError] = useState<string | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: "ok" | "error" }[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((message: string, tone: "ok" | "error" = "ok") => {
    const tid = ++toastId.current;
    setToasts((t) => [...t, { id: tid, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== tid)), tone === "error" ? 7000 : 4000);
  }, []);

  useEffect(() => {
    api<ProjectDetail>(`/api/projects/${id}`).then(setDetail, (e) => setError(e.message));
    api<{ integrations: { id: string; appUrl: string | null; configured: boolean }[]; connections: Connection[]; role: ProjectCtx["role"] }>("/api/integrations").then(
      (r) => {
        const url = (k: string) => r.integrations.find((i) => i.id === k && i.configured)?.appUrl ?? null;
        setLinks({ metainfo: url("metainfo"), socialbrewery: url("socialbrewery") });
        setConnections(r.connections);
        setRole(r.role);
      },
      () => {},
    );
  }, [id]);

  const plan = useMemo(() => (detail ? buildPlan(contextOf(detail.project), detail.assessment?.results ?? null, detail.decisions, detail.assessment?.finishedAt ?? null) : []), [detail]);
  const ready = useMemo(() => readiness(plan), [plan]);

  const go = useCallback(
    (v: View, extra: Record<string, string> = {}) => {
      const q = new URLSearchParams({ ...(v === "overview" ? {} : { view: v }), ...extra });
      router.replace(`${pathname}${q.size ? `?${q}` : ""}`, { scroll: false });
    },
    [router, pathname],
  );

  const decide = useCallback(
    async (checkId: string, status: DecisionStatus | null) => {
      try {
        setDetail(await api<ProjectDetail>(`/api/projects/${id}/decisions`, { method: "PUT", body: { checkId, status } }));
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e), "error");
      }
    },
    [id, toast],
  );

  const runAssessment = async () => {
    setAssessing(true);
    try {
      const next = await api<ProjectDetail & { regressions: { title: string }[] }>(`/api/projects/${id}/assess`, { method: "POST" });
      setDetail(next);
      toast(next.regressions.length ? `Assessment done. ${next.regressions.length} regression(s): ${next.regressions.map((r) => r.title).join(", ")}` : "Assessment done.", next.regressions.length ? "error" : "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setAssessing(false);
    }
  };

  if (error && !detail)
    return (
      <main className="page">
        <div className="notice error">{error}</div>
      </main>
    );
  if (!detail)
    return (
      <main className="page">
        <div className="skeleton" style={{ height: 28, width: 220 }} />
        <div className="skeleton" style={{ height: 120, marginTop: 20 }} />
        <div className="skeleton" style={{ height: 420, marginTop: 16 }} />
      </main>
    );

  const { project } = detail;
  const ctx: ProjectCtx = { id, detail, plan, ready, links, connections, role, setDetail, decide, go, params, toast };
  const openCount = plan.filter((i) => i.status === "open").length;

  return (
    <ProjectContext.Provider value={ctx}>
      <main className="page">
        <div className="page-head">
          <div style={{ minWidth: 0 }}>
            <h1>{project.name}</h1>
            <div className="row small muted" style={{ marginTop: 6 }}>
              <span>{PRODUCT_TYPE_LABEL[project.productType]}</span>·<span>{STAGE_LABEL[project.stage]}</span>·<span>{MONETIZATION_LABEL[project.monetization]}</span>
              {project.monetization !== "free" && project.businessType !== "undecided" && (
                <>
                  ·<span>{BUSINESS_TYPE_LABEL[project.businessType]}</span>
                </>
              )}
              {project.country && (
                <>
                  ·<span>{project.country}</span>
                </>
              )}
              {project.repoUrl && (
                <>
                  ·
                  <a href={project.repoUrl} target="_blank" rel="noreferrer">
                    Repository ↗
                  </a>
                </>
              )}
              {project.siteUrl && (
                <>
                  ·
                  <a href={project.siteUrl} target="_blank" rel="noreferrer">
                    Website ↗
                  </a>
                </>
              )}
            </div>
          </div>
          <div className="actions">
            <button className="btn btn-primary" onClick={runAssessment} disabled={assessing}>
              {assessing ? (
                <>
                  <span className="spinner" /> Assessing…
                </>
              ) : detail.assessment ? (
                "Re-assess"
              ) : (
                "Assess now"
              )}
            </button>
          </div>
        </div>

        <nav className="subnav" aria-label="Project">
          {VIEWS.map(([v, label]) => (
            <button key={v} className="subnav-link" aria-current={view === v ? "page" : undefined} onClick={() => go(v)}>
              {label}
              {v === "plan" && openCount > 0 && <span className="count">{openCount}</span>}
            </button>
          ))}
        </nav>

        {view === "overview" && <Overview />}
        {view === "plan" && <PlanView />}
        {view === "providers" && <ProvidersView />}
        {view === "workflows" && <WorkflowsView />}
        {view === "activity" && <ActivityView />}
        {view === "settings" && <SettingsView />}

        <p className="small muted" style={{ marginTop: 32 }}>
          ProductRoot gives general guidance, not legal, tax or financial advice.
        </p>
      </main>
      <Toasts items={toasts} />
    </ProjectContext.Provider>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="page" />}>
      <ProjectPage />
    </Suspense>
  );
}
