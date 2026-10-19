"use client";

import { createContext, useContext } from "react";
import type { PlanItem, Readiness } from "@/lib/core/plan";
import type { ProjectDetail } from "@/lib/core/project";
import type { DecisionStatus } from "@/lib/core/types";
import type { ToolLinks } from "../TaskCard";

export type View = "overview" | "plan" | "providers" | "workflows" | "activity" | "settings";

export interface Connection {
  provider: string;
  meta: Record<string, unknown>;
  status: "ok" | "error";
  statusMessage: string;
}

export interface ProjectCtx {
  id: string;
  detail: ProjectDetail;
  plan: PlanItem[];
  ready: Readiness;
  links: ToolLinks;
  connections: Connection[];
  role: "owner" | "admin" | "member";
  setDetail: (d: ProjectDetail) => void;
  decide: (checkId: string, status: DecisionStatus | null) => Promise<void>;
  go: (view: View, params?: Record<string, string>) => void;
  params: URLSearchParams;
  toast: (message: string, tone?: "ok" | "error") => void;
}

export const ProjectContext = createContext<ProjectCtx | null>(null);
export const useProject = () => {
  const c = useContext(ProjectContext);
  if (!c) throw new Error("useProject outside ProjectContext");
  return c;
};
