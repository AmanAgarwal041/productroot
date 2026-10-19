"use client";

import { useState } from "react";
import type { ProjectInput } from "@/lib/core/project";
import {
  BUSINESS_TYPE_LABEL,
  BUSINESS_TYPES,
  MONETIZATION_LABEL,
  MONETIZATIONS,
  PRODUCT_TYPE_LABEL,
  PRODUCT_TYPES,
  STAGE_LABEL,
  STAGES,
  type BusinessType,
  type Monetization,
  type ProductType,
  type Stage,
} from "@/lib/core/types";

export const EMPTY: ProjectInput = { name: "", description: "", repoUrl: "", siteUrl: "", productType: "saas", stage: "working", monetization: "subscription", country: "", businessType: "undecided", recheck: true };

function Choices<T extends string>({ label, hint, values, labels, value, onChange }: { label: string; hint?: string; values: readonly T[]; labels: Record<T, string>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="field span-2" role="group" aria-label={label}>
      <span>{label}</span>
      <div className="choice-group">
        {values.map((v) => (
          <button key={v} type="button" className="choice" aria-pressed={value === v} onClick={() => onChange(v)}>
            {labels[v]}
          </button>
        ))}
      </div>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export default function ProjectForm({
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
  showAdvanced = false,
}: {
  initial: ProjectInput;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (v: ProjectInput) => Promise<void>;
  showAdvanced?: boolean;
}) {
  const [v, setV] = useState<ProjectInput>({ ...initial, repoUrl: initial.repoUrl ?? "", siteUrl: initial.siteUrl ?? "", country: initial.country ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ProjectInput>(k: K, val: ProjectInput[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onSubmit(v);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          setBusy(false);
        }
      }}
    >
      <div className="card form-grid">
        <label className="field">
          <span>GitHub repository</span>
          <input className="input" placeholder="github.com/you/your-app" value={v.repoUrl ?? ""} onChange={(e) => set("repoUrl", e.target.value)} autoFocus />
          <small>Public repositories for now. Read-only: we list file paths and read package.json, nothing else.</small>
        </label>
        <label className="field">
          <span>Website</span>
          <input className="input" placeholder="yourapp.com" value={v.siteUrl ?? ""} onChange={(e) => set("siteUrl", e.target.value)} />
          <small>Your production or preview URL. Add either one, or both for a fuller picture.</small>
        </label>
        <Choices label="What are you building?" values={PRODUCT_TYPES} labels={PRODUCT_TYPE_LABEL} value={v.productType} onChange={(x: ProductType) => set("productType", x)} />
        <Choices label="Where is it today?" values={STAGES} labels={STAGE_LABEL} value={v.stage} onChange={(x: Stage) => set("stage", x)} />
        <Choices
          label="How will it make money?"
          hint="Decides whether payments, webhooks and terms are launch blockers or not needed at all."
          values={MONETIZATIONS}
          labels={MONETIZATION_LABEL}
          value={v.monetization}
          onChange={(x: Monetization) => set("monetization", x)}
        />
        <label className="field">
          <span>Name</span>
          <input className="input" placeholder="Defaults to the repository name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />
        </label>
        <label className="field">
          <span>Your country (optional)</span>
          <input className="input" placeholder="Two-letter code, e.g. IN, US, DE" value={v.country ?? ""} onChange={(e) => set("country", e.target.value.toUpperCase())} maxLength={2} />
          <small>Payment provider eligibility depends on where you sell from.</small>
        </label>
        {(showAdvanced || v.monetization !== "free") && (
          <Choices
            label="How are you set up to sell?"
            hint="Some payment providers only accept registered businesses. ProductRoot uses this to filter providers, not to give legal advice."
            values={BUSINESS_TYPES}
            labels={BUSINESS_TYPE_LABEL}
            value={v.businessType}
            onChange={(x: BusinessType) => set("businessType", x)}
          />
        )}
        {showAdvanced && (
          <label className="row span-2 small">
            <input type="checkbox" checked={v.recheck} onChange={(e) => set("recheck", e.target.checked)} />
            Re-assess automatically every day and notify me about regressions
          </label>
        )}
      </div>
      {error && <div className="notice error" role="alert">{error}</div>}
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
