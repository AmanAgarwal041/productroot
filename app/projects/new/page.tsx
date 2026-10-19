"use client";

import { useRouter } from "next/navigation";
import ProjectForm, { EMPTY } from "@/components/ProjectForm";
import { api } from "@/lib/client/api";
import type { Project } from "@/lib/core/project";

export default function NewProjectPage() {
  const router = useRouter();
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Check your product&apos;s readiness</h1>
          <p className="sub">Start with what you have. Everything else can be added or changed later.</p>
        </div>
      </div>
      <ProjectForm
        initial={EMPTY}
        submitLabel="Create and assess"
        busyLabel="Assessing… this takes up to a minute"
        onSubmit={async (v) => {
          const { project } = await api<{ project: Project }>("/api/projects", { method: "POST", body: v });
          // Run the first assessment straight away; the dashboard shows the result.
          await api(`/api/projects/${project.id}/assess`, { method: "POST" }).catch(() => {});
          router.push(`/projects/${project.id}`);
        }}
      />
    </main>
  );
}
