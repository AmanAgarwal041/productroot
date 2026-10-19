"use client";

import { useState } from "react";
import { AREA_LABEL, type Area } from "@/lib/core/checks";
import type { PlanItem } from "@/lib/core/plan";
import type { Priority } from "@/lib/core/types";
import TaskCard, { PRIORITY_LABEL } from "../TaskCard";
import { useProject } from "./context";
import { TaskActions, useChosen } from "./TaskActions";

type Tab = "todo" | "skipped" | "done" | "na";
const TABS: [Tab, string][] = [
  ["todo", "To do"],
  ["skipped", "Skipped"],
  ["done", "Done"],
  ["na", "Not applicable"],
];
const STATUS: Record<Tab, PlanItem["status"]> = { todo: "open", skipped: "skipped", done: "done", na: "not_applicable" };

export default function PlanView() {
  const { plan, links, decide, params, go } = useProject();
  const chosen = useChosen();
  const tab = (params.get("tab") as Tab) || "todo";
  const [area, setArea] = useState<Area | "all">("all");

  const inTab = (t: Tab) => plan.filter((i) => i.status === STATUS[t]);
  const items = inTab(tab).filter((i) => area === "all" || i.area === area);
  const areas = [...new Set(inTab(tab).map((i) => i.area))];
  const card = (i: PlanItem) => <TaskCard key={i.id} item={i} links={links} onDecide={decide} extra={<TaskActions item={i} />} chosen={chosen(i)} defaultOpen={params.get("open") === i.id} />;

  return (
    <div>
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => (setArea("all"), go("plan", k === "todo" ? {} : { tab: k }))}>
            {label}
            <span className="count">{inTab(k).length}</span>
          </button>
        ))}
      </div>

      {areas.length > 1 && (
        <div className="choice-group" style={{ marginBottom: 14 }}>
          <button className="choice" aria-pressed={area === "all"} onClick={() => setArea("all")}>
            All areas
          </button>
          {areas.map((a) => (
            <button key={a} className="choice" aria-pressed={area === a} onClick={() => setArea(a)}>
              {AREA_LABEL[a]}
            </button>
          ))}
        </div>
      )}

      {tab === "todo" ? (
        (["blocker", "recommended", "optional"] as Priority[]).map((p) => {
          const group = items.filter((i) => i.priority === p);
          if (!group.length) return null;
          return (
            <section key={p} style={{ marginBottom: 20 }}>
              <h3 className="row" style={{ fontSize: 14, marginBottom: 8 }}>
                <span className={`badge b-${p}`}>{PRIORITY_LABEL[p]}</span>
                <span className="muted small">{group.length}</span>
              </h3>
              <div className="tasks">{group.map(card)}</div>
            </section>
          );
        })
      ) : (
        <div className="tasks">{items.map(card)}</div>
      )}
      {items.length === 0 && <p className="muted">{tab === "todo" ? "Nothing left to do. Re-assess after changes to keep the evidence fresh." : "Nothing here."}</p>}
    </div>
  );
}
