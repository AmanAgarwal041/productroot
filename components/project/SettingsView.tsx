"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import type { ProjectDetail } from "@/lib/core/project";
import ProjectForm from "../ProjectForm";
import { useProject } from "./context";

export default function SettingsView() {
  const { id, detail, setDetail, toast, role } = useProject();
  const router = useRouter();
  return (
    <div className="stack">
      <p className="small muted">Changing the product type, stage, monetisation or business type re-prioritises the plan instantly. Changing the repository or website needs a re-assessment.</p>
      <ProjectForm
        initial={detail.project}
        submitLabel="Save changes"
        busyLabel="Saving…"
        showAdvanced
        onSubmit={async (v) => {
          setDetail(await api<ProjectDetail>(`/api/projects/${id}`, { method: "PATCH", body: v }));
          toast("Saved.");
        }}
      />
      {role !== "member" && (
        <div className="card danger-zone">
          <div>
            <strong>Delete project</strong>
            <p className="small muted">Removes its assessments, decisions, provider choices and workflow history. Pull requests and posts already made are not affected.</p>
          </div>
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (!window.confirm(`Delete "${detail.project.name}"? This can't be undone.`)) return;
              try {
                await api(`/api/projects/${id}`, { method: "DELETE" });
                router.push("/projects");
              } catch (e) {
                toast(e instanceof Error ? e.message : String(e), "error");
              }
            }}
          >
            Delete project
          </button>
        </div>
      )}
    </div>
  );
}
