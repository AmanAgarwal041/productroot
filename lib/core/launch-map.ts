// Layout for the launch-progress diagram: the plan as a left-to-right flow
// of phases, a "Launch-ready" gate fed by every launch blocker, and the
// operate phase after it. Pure, so the layout is unit tested; the xyflow
// component (components/LaunchMap.tsx) only renders it.

import type { Area } from "./checks";
import type { PlanItem } from "./plan";
import { SATISFIED } from "./types";

export const PHASES: { id: string; label: string; hint: string; areas: Area[] }[] = [
  { id: "foundations", label: "Foundations", hint: "Deploys, CI and hygiene", areas: ["infra", "quality"] },
  { id: "product", label: "Product", hint: "Accounts and money", areas: ["auth", "payments"] },
  { id: "trust", label: "Trust", hint: "Security, legal, support", areas: ["security", "legal", "support", "opensource"] },
  { id: "launch", label: "Launch", hint: "Get found, announce", areas: ["growth"] },
  { id: "operate", label: "Operate", hint: "After launch", areas: ["operations"] },
];

export const COL_W = 280;
export const ROW_H = 78;
export const HEADER_H = 84;
const GATE_COL = 4; // the gate sits between "launch" and "operate"

export interface MapNode {
  id: string;
  type: "phase" | "task" | "gate";
  x: number;
  y: number;
  data: Record<string, unknown>;
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  kind: "dependency" | "gate" | "operate";
  /** The source is done, so the path is clear. */
  satisfied: boolean;
}

export interface LaunchGraph {
  nodes: MapNode[];
  edges: MapEdge[];
  ready: boolean;
}

const colOf = (phaseIndex: number) => (phaseIndex >= GATE_COL ? phaseIndex + 1 : phaseIndex);

/** Operations work is post-launch, unless the context makes it a launch blocker (e.g. backups for a live SaaS). */
export const phaseOf = (i: Pick<PlanItem, "area" | "priority">) =>
  i.area === "operations" && i.priority === "blocker" ? "launch" : PHASES.find((p) => p.areas.includes(i.area))!.id;

export function buildLaunchGraph(items: PlanItem[], opts: { showNotApplicable?: boolean } = {}): LaunchGraph {
  const visible = items.filter((i) => opts.showNotApplicable || i.priority !== null);
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const ok = (i: PlanItem) => SATISFIED.has(i.state);
  const rank = (i: PlanItem) => (i.priority === "blocker" ? 0 : i.priority === "recommended" ? 1 : i.priority === "optional" ? 2 : 3);
  const placed = new Set<string>();

  PHASES.forEach((phase, pi) => {
    const inPhase = visible.filter((i) => phaseOf(i) === phase.id).sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
    const x = colOf(pi) * COL_W;
    const applicable = inPhase.filter((i) => i.priority !== null);
    nodes.push({
      id: `phase:${phase.id}`,
      type: "phase",
      x,
      y: 0,
      data: { label: phase.label, hint: phase.hint, done: applicable.filter(ok).length, total: applicable.length },
    });
    inPhase.forEach((item, row) => {
      placed.add(item.id);
      nodes.push({
        id: item.id,
        type: "task",
        x,
        y: HEADER_H + row * ROW_H,
        data: { title: item.title, state: item.state, status: item.status, priority: item.priority, blocked: item.blockedBy.length > 0 && item.status === "open" },
      });
    });
  });

  const blockers = visible.filter((i) => i.priority === "blocker");
  const ready = blockers.every((i) => ok(i));
  nodes.push({
    id: "gate",
    type: "gate",
    x: GATE_COL * COL_W,
    y: HEADER_H,
    data: { ready, done: blockers.filter(ok).length, total: blockers.length, skipped: blockers.filter((i) => i.status === "skipped").length },
  });

  for (const item of visible) {
    for (const dep of item.dependsOn) {
      if (!placed.has(dep)) continue;
      const depItem = items.find((i) => i.id === dep)!;
      edges.push({ id: `dep:${dep}->${item.id}`, source: dep, target: item.id, kind: "dependency", satisfied: ok(depItem) });
    }
    if (item.priority === "blocker" && placed.has(item.id)) edges.push({ id: `gate:${item.id}`, source: item.id, target: "gate", kind: "gate", satisfied: ok(item) });
    if (phaseOf(item) === "operate" && placed.has(item.id)) edges.push({ id: `op:${item.id}`, source: "gate", target: item.id, kind: "operate", satisfied: ready });
  }
  return { nodes, edges, ready };
}
