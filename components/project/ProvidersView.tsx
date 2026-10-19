"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import { CAPABILITIES, CAPABILITY_CHECKS, CAPABILITY_LABEL, compareProviders, type Capability, type ProviderFit } from "@/lib/core/catalog";
import { CATALOG, CATALOG_VERIFIED_AT } from "@/lib/core/catalog-data";
import type { ProjectDetail } from "@/lib/core/project";
import { BUSINESS_TYPE_LABEL, BUSINESS_TYPES, type BusinessType } from "@/lib/core/types";
import { useProject } from "./context";

const ELIGIBILITY: Record<ProviderFit["eligibility"], [string, string]> = {
  eligible: ["Eligible", "b-verified"],
  unknown: ["Eligibility unknown", "b-needs_confirmation"],
  ineligible: ["Not eligible", "b-missing"],
};
const SETUP = { minutes: "Minutes", hours: "Hours", days: "Days" } as const;
const TONE_ICON = { plus: "+", minus: "−", info: "i" } as const;

function EligibilityInputs() {
  const { id, detail, setDetail, toast } = useProject();
  const [country, setCountry] = useState(detail.project.country ?? "");
  const [biz, setBiz] = useState<BusinessType>(detail.project.businessType);
  const [busy, setBusy] = useState(false);
  const dirty = country !== (detail.project.country ?? "") || biz !== detail.project.businessType;
  return (
    <div className="card eligibility-bar">
      <div>
        <strong>Selling from</strong>
        <p className="small muted">Payment providers accept sellers by country and business type. We filter on these, never guess.</p>
      </div>
      <input className="input" style={{ width: 90 }} placeholder="e.g. IN" maxLength={2} value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} aria-label="Country code" />
      <select className="select" style={{ width: 220 }} value={biz} onChange={(e) => setBiz(e.target.value as BusinessType)} aria-label="Business type">
        {BUSINESS_TYPES.map((b) => (
          <option key={b} value={b}>
            {BUSINESS_TYPE_LABEL[b]}
          </option>
        ))}
      </select>
      <button
        className="btn btn-primary"
        disabled={!dirty || busy}
        onClick={async () => {
          setBusy(true);
          try {
            setDetail(await api<ProjectDetail>(`/api/projects/${id}`, { method: "PATCH", body: { country, businessType: biz } }));
            toast("Saved. Eligibility updated.");
          } catch (e) {
            toast(e instanceof Error ? e.message : String(e), "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        Update
      </button>
    </div>
  );
}

function ProviderCard({ fit, chosen, onChoose }: { fit: ProviderFit; chosen: boolean; onChoose: (choose: boolean) => Promise<void> }) {
  const p = fit.provider;
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [label, cls] = ELIGIBILITY[fit.eligibility];
  const choose = async (v: boolean) => {
    if (v && fit.eligibility === "ineligible" && !window.confirm(`${p.name} is not listed as available for your situation. Choose it anyway?`)) return;
    setBusy(true);
    try {
      await onChoose(v);
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className={`provider${chosen ? " is-chosen" : ""}${fit.eligibility === "ineligible" ? " is-ineligible" : ""}`}>
      <header className="provider-head">
        <div style={{ minWidth: 0 }}>
          <div className="row">
            <h3>{p.name}</h3>
            {fit.inUse && <span className="badge b-recommended plain">In your code</span>}
            {p.capability === "payments" && <span className={`badge ${cls}`}>{label}</span>}
            {fit.stale && <span className="badge plain">Needs re-verification</span>}
          </div>
          <p className="small muted" style={{ marginTop: 2 }}>{p.summary}</p>
        </div>
        <div className="provider-cta">
          {chosen ? (
            <>
              <span className="badge b-verified">Chosen</span>
              <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => choose(false)}>
                Clear
              </button>
            </>
          ) : (
            <button className="btn btn-sm" disabled={busy} onClick={() => choose(true)}>
              Choose
            </button>
          )}
        </div>
      </header>

      <ul className="reasons">
        {fit.reasons.map((r, i) => (
          <li key={i} className={`r-${r.tone}`}>
            <span aria-hidden="true">{TONE_ICON[r.tone]}</span>
            {r.text}
          </li>
        ))}
      </ul>

      <dl className="facts">
        <div>
          <dt>Pricing</dt>
          <dd>{p.pricingModel}</dd>
        </div>
        {p.fees && (
          <div>
            <dt>Fees</dt>
            <dd>{p.fees}</dd>
          </div>
        )}
        <div>
          <dt>Free tier</dt>
          <dd>{p.freeTier ?? <span className="muted">Not confirmed</span>}</dd>
        </div>
        <div>
          <dt>Setup</dt>
          <dd>
            {SETUP[p.setup]} · {p.integration === "integrated" ? "ProductRoot can verify it" : "Guided setup"}
          </dd>
        </div>
      </dl>

      <button className="link-btn small" onClick={() => setMore((m) => !m)} aria-expanded={more}>
        {more ? "Hide details" : "Prerequisites, limitations and sources"}
      </button>
      {more && (
        <div className="provider-more">
          {p.prerequisites.length > 0 && (
            <div>
              <h4>Prerequisites</h4>
              <ul>
                {p.prerequisites.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {p.limitations.length > 0 && (
            <div>
              <h4>Limitations</h4>
              <ul>
                {p.limitations.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h4>Sources · verified {p.verifiedAt}</h4>
            <ul>
              {p.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}

export default function ProvidersView() {
  const { id, detail, plan, params, go, setDetail, toast } = useProject();
  const { project } = detail;
  const relevant = CAPABILITIES.filter((c) => CAPABILITY_CHECKS[c].some((check) => plan.find((i) => i.id === check)?.priority !== null));
  const [showAll, setShowAll] = useState(false);
  const caps = showAll ? [...CAPABILITIES] : relevant;
  const cap = (params.get("cap") as Capability) || caps[0] || "hosting";

  const fits = compareProviders(CATALOG, cap, {
    country: project.country,
    businessType: project.businessType,
    monetization: project.monetization,
    frameworks: project.stack?.frameworks ?? [],
    detected: [...(project.stack?.auth ?? []), ...(project.stack?.billing ?? []), ...(project.stack?.hosting ?? [])],
  });

  const choose = (providerId: string | null) => async () => {
    try {
      setDetail(await api<ProjectDetail>(`/api/projects/${id}/choices`, { method: "PUT", body: { capability: cap, providerId } }));
      toast(providerId ? "Choice saved. Continue with the related tasks in the plan." : "Choice cleared.");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  return (
    <div className="stack">
      <div className="row">
        <div className="choice-group">
          {caps.map((c) => (
            <button key={c} className="choice" aria-pressed={c === cap} onClick={() => go("providers", { cap: c })}>
              {CAPABILITY_LABEL[c]}
              {detail.choices[c] ? " ✓" : ""}
            </button>
          ))}
        </div>
        <label className="small muted" style={{ marginLeft: "auto" }}>
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show capabilities this product doesn&apos;t need
        </label>
      </div>

      {cap === "payments" && <EligibilityInputs />}

      <p className="small muted">
        Ranked by fit: eligibility first, then what you already use, official support for your framework, and setup effort. Never by price alone. Facts are sourced and were verified on {CATALOG_VERIFIED_AT}; always confirm
        on the provider&apos;s site before committing. This is general guidance, not legal, tax or financial advice.
      </p>

      <div className="provider-grid">
        {fits.map((f) => (
          <ProviderCard key={f.provider.id} fit={f} chosen={detail.choices[cap] === f.provider.id} onChoose={(v) => choose(v ? f.provider.id : null)()} />
        ))}
        {fits.length === 0 && <p className="muted">No providers catalogued for this capability yet.</p>}
      </div>
    </div>
  );
}
