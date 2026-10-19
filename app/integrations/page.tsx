"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";

type Support = "integrated" | "guided" | "unsupported";
interface Info {
  id: string;
  name: string;
  description: string;
  appUrl: string | null;
  configured: boolean;
  note: string;
  capabilities: Record<"connect" | "discover" | "read" | "execute" | "verify", Support>;
}
interface Conn {
  provider: string;
  meta: Record<string, unknown>;
  status: "ok" | "error";
  statusMessage: string;
  connectedAt: string;
}

const SUPPORT: Record<Support, [string, string]> = {
  integrated: ["Integrated", "b-verified"],
  guided: ["Guided", "b-recommended"],
  unsupported: ["Not yet", "b-not_applicable"],
};
const CAPS = ["connect", "discover", "read", "execute", "verify"] as const;

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder?: string;
}

const FORMS: Record<string, { provider: string; title: string; fields: FieldDef[]; steps: React.ReactNode[] }[]> = {
  github: [
    {
      provider: "github",
      title: "Fine-grained personal access token",
      fields: [{ key: "token", label: "Token", type: "password", placeholder: "github_pat_…" }],
      steps: [
        <>
          Open{" "}
          <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
            GitHub → Fine-grained tokens ↗
          </a>
        </>,
        "Repository access: only the repositories you want assessed.",
        "Permissions: Contents → Read and write, Pull requests → Read and write, Metadata → Read. Read-only Contents is enough if you only want private-repo assessments.",
        "ProductRoot only ever writes to new productroot/* branches and opens pull requests; it never pushes to your default branch.",
      ],
    },
  ],
  socialbrewery: [
    {
      provider: "socialbrewery",
      title: "MCP connector",
      fields: [
        { key: "url", label: "SocialBrewery URL", type: "url", placeholder: "https://socialbrewery.example.com" },
        { key: "token", label: "Connector token", type: "password" },
      ],
      steps: ["In SocialBrewery, open Connectors and copy the organisation's connector token.", "Connect your social networks in SocialBrewery itself; ProductRoot can't do that for you.", "Every post from ProductRoot needs an approval and runs exactly once."],
    },
  ],
  uptime: [
    {
      provider: "uptimerobot",
      title: "UptimeRobot",
      fields: [{ key: "apiKey", label: "Read-only API key", type: "password" }],
      steps: ["UptimeRobot → Integrations & API → create a Read-only API key."],
    },
    {
      provider: "betterstack",
      title: "Better Stack",
      fields: [{ key: "apiKey", label: "Uptime API token", type: "password" }],
      steps: ["Better Stack → Settings → API tokens → create an Uptime API token."],
    },
  ],
};

function ConnectForm({ form, onDone }: { form: (typeof FORMS)[string][number]; onDone: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="conn-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api(`/api/connections/${form.provider}`, { method: "PUT", body: values });
          setValues({});
          onDone();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <strong className="small">{form.title}</strong>
      <ol className="steps">
        {form.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <div className="form-grid">
        {form.fields.map((f) => (
          <label key={f.key} className="field">
            <span>{f.label}</span>
            <input className="input" type={f.type} autoComplete="off" placeholder={f.placeholder} value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
          </label>
        ))}
      </div>
      {error && <div className="notice error small">{error}</div>}
      <div className="row">
        <button className="btn btn-primary btn-sm" disabled={busy || form.fields.some((f) => !values[f.key])}>
          {busy ? "Checking…" : "Verify and connect"}
        </button>
        <span className="small muted">The credential is checked with the provider, then stored encrypted. It never reaches your browser again.</span>
      </div>
    </form>
  );
}

export default function IntegrationsPage() {
  const [items, setItems] = useState<Info[] | null>(null);
  const [conns, setConns] = useState<Conn[]>([]);
  const [role, setRole] = useState<string>("owner");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api<{ integrations: Info[]; connections: Conn[]; role: string }>("/api/integrations").then(
        (r) => {
          setItems(r.integrations);
          setConns(r.connections);
          setRole(r.role);
        },
        (e) => setError(e.message),
      ),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const connFor = (id: string) => conns.find((c) => c.provider === id || (id === "uptime" && (c.provider === "uptimerobot" || c.provider === "betterstack")));
  const admin = role !== "member";

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Integrations</h1>
          <p className="sub">What ProductRoot can do through each service. &ldquo;Guided&rdquo; means you do the step in that service and we tell you how; &ldquo;Integrated&rdquo; means we can do or verify it, always with your approval for changes.</p>
        </div>
      </div>
      {error && <div className="notice error">{error}</div>}
      {!items && !error && <div className="skeleton" style={{ height: 300 }} />}
      <div className="stack">
        {items?.map((i) => {
          const conn = connFor(i.id);
          const forms = FORMS[i.id];
          return (
            <section className="card" key={i.id}>
              <div className="card-head">
                <h2>{i.name}</h2>
                {conn ? (
                  <span className={`badge ${conn.status === "ok" ? "b-verified" : "b-missing"}`}>{conn.status === "ok" ? "Connected" : "Needs attention"}</span>
                ) : (
                  <span className={`badge ${i.configured ? "b-verified" : "b-not_applicable"}`}>{i.configured ? "Available" : "Not connected"}</span>
                )}
                <div className="row" style={{ marginLeft: "auto" }}>
                  {i.appUrl && i.configured && (
                    <a className="small" href={i.appUrl} target="_blank" rel="noreferrer">
                      Open ↗
                    </a>
                  )}
                  {forms && admin && !conn && (
                    <button className="btn btn-sm" onClick={() => setOpen((o) => (o === i.id ? null : i.id))}>
                      {open === i.id ? "Cancel" : "Connect"}
                    </button>
                  )}
                  {conn && admin && (
                    <button
                      className="btn btn-sm btn-ghost btn-danger"
                      onClick={async () => {
                        if (!window.confirm(`Disconnect ${i.name}? ProductRoot forgets the credential. Revoke it at the provider too.`)) return;
                        await api(`/api/connections/${conn.provider}`, { method: "DELETE" }).catch((e) => setError(e.message));
                        load();
                      }}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
              <p>{i.description}</p>
              <p className="small muted" style={{ marginTop: 6 }}>
                {i.note}
              </p>
              {conn?.status === "error" && <div className="notice error small" style={{ marginTop: 10 }}>{conn.statusMessage}</div>}
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="cap-table">
                  <thead>
                    <tr>
                      {CAPS.map((c) => (
                        <th key={c} style={{ textTransform: "capitalize" }}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {CAPS.map((c) => (
                        <td key={c}>
                          <span className={`badge ${SUPPORT[i.capabilities[c]][1]}`}>{SUPPORT[i.capabilities[c]][0]}</span>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              {open === i.id &&
                forms?.map((f) => (
                  <ConnectForm
                    key={f.provider}
                    form={f}
                    onDone={() => {
                      setOpen(null);
                      load();
                    }}
                  />
                ))}
              {!admin && !conn && forms && <p className="small muted" style={{ marginTop: 10 }}>Ask a workspace admin to connect this.</p>}
            </section>
          );
        })}
      </div>
    </main>
  );
}
