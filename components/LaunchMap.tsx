"use client";

// The launch map: the plan rendered with xyflow. Columns are phases, the gate
// is "Launch-ready", edge colour says whether the path is clear. Click a task
// to open it.

import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { buildLaunchGraph, COL_W } from "@/lib/core/launch-map";
import type { PlanItem } from "@/lib/core/plan";
import type { CheckState, Priority } from "@/lib/core/types";
import { STATE_LABEL } from "./TaskCard";

type TaskData = { title: string; state: CheckState; status: string; priority: Priority | null; blocked: boolean; selected?: boolean };
type PhaseData = { label: string; hint: string; done: number; total: number };
type GateData = { ready: boolean; done: number; total: number; skipped: number };

const hidden = { opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0 };

function TaskNode({ data }: NodeProps<Node<TaskData>>) {
  return (
    <div className={`lm-task s-${data.state}${data.selected ? " is-selected" : ""}${data.status === "skipped" ? " is-skipped" : ""}`}>
      <Handle type="target" position={Position.Left} style={hidden} />
      <div className="lm-task-title">{data.title}</div>
      <div className="lm-task-meta">
        <span className={`lm-dot s-${data.state}`} />
        {data.status === "skipped" ? "Skipped" : STATE_LABEL[data.state]}
        {data.priority === "blocker" && <span className="lm-flag">Blocker</span>}
        {data.blocked && <span className="lm-flag muted">Waiting</span>}
      </div>
      <Handle type="source" position={Position.Right} style={hidden} />
    </div>
  );
}

function PhaseNode({ data }: NodeProps<Node<PhaseData>>) {
  const pct = data.total ? Math.round((data.done / data.total) * 100) : 100;
  return (
    <div className="lm-phase">
      <div className="lm-phase-row">
        <strong>{data.label}</strong>
        <span className="num">
          {data.done}/{data.total}
        </span>
      </div>
      <div className="lm-phase-hint">{data.hint}</div>
      <div className="meter pass" style={{ marginTop: 6 }}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function GateNode({ data }: NodeProps<Node<GateData>>) {
  return (
    <div className={`lm-gate${data.ready ? " is-ready" : ""}`}>
      <Handle type="target" position={Position.Left} style={hidden} />
      <div className="lm-gate-icon" aria-hidden="true">
        {data.ready ? "✓" : "◆"}
      </div>
      <strong>Launch-ready</strong>
      <span className="small">
        {data.done}/{data.total} blockers covered
        {data.skipped ? ` · ${data.skipped} skipped` : ""}
      </span>
      <Handle type="source" position={Position.Right} style={hidden} />
    </div>
  );
}

const nodeTypes = { task: TaskNode, phase: PhaseNode, gate: GateNode };

// xyflow's colorMode="system" reads matchMedia during render, so the server
// renders "light" and a dark-mode browser hydrates "dark": a hydration mismatch
// that sent `next dev` into a reload loop. Render "light" until hydrated, then
// follow the system (and any explicit data-theme) like the rest of the app.
const DARK = "(prefers-color-scheme: dark)";
function subscribe(cb: () => void) {
  const mq = window.matchMedia(DARK);
  mq.addEventListener("change", cb);
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    mq.removeEventListener("change", cb);
    obs.disconnect();
  };
}
function colorMode(): "light" | "dark" {
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return window.matchMedia(DARK).matches ? "dark" : "light";
}
const useColorMode = () => useSyncExternalStore(subscribe, colorMode, () => "light" as const);

export default function LaunchMap({ items, height = 560, onSelect, selectedId, interactive = true }: { items: PlanItem[]; height?: number; onSelect?: (id: string) => void; selectedId?: string | null; interactive?: boolean }) {
  const [showNa, setShowNa] = useState(false);
  const mode = useColorMode();
  const graph = useMemo(() => buildLaunchGraph(items, { showNotApplicable: showNa }), [items, showNa]);

  const nodes: Node[] = useMemo(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: { x: n.x, y: n.y },
        data: n.id === selectedId ? { ...n.data, selected: true } : n.data,
        draggable: false,
        connectable: false,
        selectable: n.type === "task",
        style: { width: COL_W - 40 },
      })),
    [graph, selectedId],
  );

  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        animated: !e.satisfied && e.kind !== "operate",
        className: `lm-edge k-${e.kind} ${e.satisfied ? "ok" : "open"}`,
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
      })),
    [graph],
  );

  return (
    <div className="lm-wrap" style={{ height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={interactive}
        panOnScroll={false}
        zoomOnScroll={interactive}
        panOnDrag={interactive}
        proOptions={{ hideAttribution: true }}
        colorMode={mode}
        onNodeClick={(_, n) => n.type === "task" && onSelect?.(n.id)}
      >
        <Background gap={20} size={1} />
        {interactive && <Controls showInteractive={false} position="bottom-right" />}
      </ReactFlow>
      {interactive && (
        <div className="lm-toolbar">
          <span className="lm-legend">
            <i className="lm-dot s-verified" /> Done
            <i className="lm-dot s-needs_confirmation" /> Needs input
            <i className="lm-dot s-missing" /> Missing
          </span>
          <label className="small">
            <input type="checkbox" checked={showNa} onChange={(e) => setShowNa(e.target.checked)} /> Show not applicable
          </label>
        </div>
      )}
    </div>
  );
}
