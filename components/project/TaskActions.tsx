"use client";

import { capabilityForCheck, CAPABILITY_LABEL } from "@/lib/core/catalog";
import { CATALOG } from "@/lib/core/catalog-data";
import { GENERATOR_BY_CHECK } from "@/lib/core/generators";
import type { PlanItem } from "@/lib/core/plan";
import { useProject } from "./context";

/** Contextual next steps for a task: compare providers, generate a PR, draft a post. */
export function TaskActions({ item }: { item: PlanItem }) {
  const { go } = useProject();
  const cap = capabilityForCheck(item.id);
  const open = item.status === "open" || item.status === "skipped";
  return (
    <>
      {cap && (
        <button className="btn btn-sm" onClick={() => go("providers", { cap })}>
          Compare {CAPABILITY_LABEL[cap].toLowerCase()} options
        </button>
      )}
      {open && GENERATOR_BY_CHECK[item.id] && (
        <button className="btn btn-sm" onClick={() => go("workflows", { generate: item.id })}>
          Generate a pull request
        </button>
      )}
      {open && item.id === "growth.launch_announcement" && (
        <button className="btn btn-sm" onClick={() => go("workflows", { post: "1" })}>
          Draft a launch post
        </button>
      )}
    </>
  );
}

/** Name of the chosen provider for this item's capability, if any. */
export function useChosen() {
  const { detail } = useProject();
  return (item: PlanItem) => {
    const cap = capabilityForCheck(item.id);
    const id = cap ? detail.choices[cap] : null;
    return id ? (CATALOG.find((p) => p.id === id)?.name ?? null) : null;
  };
}
