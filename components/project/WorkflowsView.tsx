"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { CHECK_BY_ID } from "@/lib/core/checks";
import { generate, GENERATORS, type GenContext } from "@/lib/core/generators";
import { parseGithubRepo } from "@/lib/core/urls";
import { IDEMPOTENT, RUN_KIND_LABEL, RUN_STATUS_LABEL, type RunStatus, type WorkflowRun } from "@/lib/core/workflow";
import { useProject } from "./context";
import { ago } from "./Overview";

const STATUS_CLASS: Record<RunStatus, string> = {
  pending_approval: "b-needs_confirmation",
  running: "b-recommended",
  succeeded: "b-verified",
  failed: "b-missing",
  rejected: "b-not_applicable",
  cancelled: "b-not_applicable",
};

// ------------------------------------------------------------------ PR composer

function PullRequestComposer({ onProposed, onClose }: { onProposed: (r: WorkflowRun) => void; onClose: () => void }) {
  const { id, detail, plan, connections, params, toast } = useProject();
  const { project } = detail;
  const gh = project.repoUrl ? parseGithubRepo(project.repoUrl) : null;
  const ctx = useMemo<GenContext | null>(() => {
    const repo = project.repoUrl ? parseGithubRepo(project.repoUrl) : null;
    return repo
      ? { owner: repo.owner, repo: repo.repo, productName: project.name, siteUrl: project.siteUrl, packageManager: project.stack?.packageManager ?? null, scripts: project.stack?.scripts ?? [], js: !!project.stack && !project.stack.nonJs }
      : null;
  }, [project]);
  const candidates = GENERATORS.filter((g) => {
    const item = plan.find((i) => i.id === g.checkId);
    return item && item.priority !== null && (item.status === "open" || item.status === "skipped");
  });
  const [picked, setPicked] = useState<string[]>(() => {
    const want = params.get("generate");
    return want && candidates.some((c) => c.checkId === want) ? [want] : [];
  });
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => (ctx && picked.length ? generate(ctx, picked, values) : null), [ctx, picked, values]);
  const connected = connections.some((c) => c.provider === "github");

  if (!gh) return <div className="notice">Add a GitHub repository to this project (Settings) to generate pull requests.</div>;
  return (
    <div className="card stack">
      <div className="card-head" style={{ margin: 0 }}>
        <h2>New pull request</h2>
        <button className="btn btn-sm btn-ghost" style={{ marginLeft: "auto" }} onClick={onClose}>
          Close
        </button>
      </div>
      {!connected && (
        <div className="notice">
          Opening pull requests needs a GitHub connection. <Link href="/integrations">Connect GitHub</Link>. You can still preview the files here.
        </div>
      )}
      {candidates.length === 0 ? (
        <p className="muted">No open plan items can be fixed by adding a file right now.</p>
      ) : (
        <div className="gen-list">
          {candidates.map((g) => {
            const why = ctx && g.unavailable(ctx);
            const on = picked.includes(g.checkId);
            return (
              <div key={g.checkId} className={`gen-item${on ? " is-on" : ""}`}>
                <label className="row" style={{ alignItems: "flex-start", gap: 10 }}>
                  <input type="checkbox" disabled={!!why} checked={on} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, g.checkId] : p.filter((x) => x !== g.checkId)))} style={{ marginTop: 3 }} />
                  <span>
                    <strong>{g.title}</strong>
                    <span className="small muted" style={{ display: "block" }}>
                      For “{CHECK_BY_ID[g.checkId].title}”. {why ?? g.description}
                    </span>
                  </span>
                </label>
                {on &&
                  ctx &&
                  g.params(ctx).map((p) => (
                    <label key={p.key} className="field" style={{ marginTop: 10, marginLeft: 26 }}>
                      <span>
                        {p.label}
                        {p.required ? "" : " (optional)"}
                      </span>
                      <input
                        className="input"
                        type={p.kind === "email" ? "email" : "text"}
                        defaultValue={p.default}
                        onChange={(e) => setValues((v) => ({ ...v, [g.checkId]: { ...v[g.checkId], [p.key]: e.target.value } }))}
                      />
                      {p.help && <small>{p.help}</small>}
                    </label>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {preview && !preview.ok && <div className="notice error">{preview.error}</div>}
      {preview?.ok && (
        <div>
          <h4 className="small muted" style={{ marginBottom: 6 }}>
            Preview: {preview.files.length} new file{preview.files.length === 1 ? "" : "s"} on a new branch. Existing files are never overwritten.
          </h4>
          {preview.files.map((f) => (
            <details key={f.path} className="file-preview">
              <summary className="mono">{f.path}</summary>
              <pre>{f.content}</pre>
            </details>
          ))}
        </div>
      )}

      <div className="row">
        <button
          className="btn btn-primary"
          disabled={!connected || !preview?.ok || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const { run } = await api<{ run: WorkflowRun }>(`/api/projects/${id}/workflows`, { method: "POST", body: { kind: "pull_request", checkIds: picked, params: values } });
              onProposed(run);
              toast("Proposed. Approve it below to open the pull request.");
            } catch (e) {
              toast(e instanceof Error ? e.message : String(e), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Propose pull request
        </button>
        <span className="small muted">Nothing happens on GitHub until an admin approves.</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- post composer

interface ToolDef {
  name: string;
  description: string;
  consequential: boolean;
  inputSchema: { properties?: Record<string, { type?: string; description?: string }>; required?: string[] };
}

const LONG_FIELDS = /^(text|commentary|content|contentMarkdown|markdown|description|body)$/;

function PostComposer({ onProposed, onClose }: { onProposed: (r: WorkflowRun) => void; onClose: () => void }) {
  const { id, detail, connections, toast } = useProject();
  const connected = connections.some((c) => c.provider === "socialbrewery");
  const [tools, setTools] = useState<ToolDef[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState("");
  const [args, setArgs] = useState<Record<string, string | boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!connected) return;
    api<{ ok: boolean; data?: ToolDef[]; error?: string }>("/api/integrations/socialbrewery").then(
      (r) => (r.ok && r.data ? setTools(r.data.filter((t) => /^(post_|publish_)/.test(t.name))) : setError(r.error ?? "Couldn't load tools.")),
      (e) => setError(e.message),
    );
  }, [connected]);

  const def = tools?.find((t) => t.name === tool);
  const props = Object.entries(def?.inputSchema.properties ?? {}).filter(([k, v]) => !/mediaId|videoUrl/.test(k) && v.type !== "object" && v.type !== "array");

  return (
    <div className="card stack">
      <div className="card-head" style={{ margin: 0 }}>
        <h2>New launch post</h2>
        <button className="btn btn-sm btn-ghost" style={{ marginLeft: "auto" }} onClick={onClose}>
          Close
        </button>
      </div>
      {!connected ? (
        <div className="notice">
          Posting goes through SocialBrewery. <Link href="/integrations">Connect SocialBrewery</Link> with its connector token first.
        </div>
      ) : error ? (
        <div className="notice error">{error}</div>
      ) : !tools ? (
        <p className="muted">Loading SocialBrewery tools…</p>
      ) : (
        <>
          <label className="field">
            <span>Where to post</span>
            <select className="select" value={tool} onChange={(e) => (setTool(e.target.value), setArgs({}))}>
              <option value="">Choose…</option>
              {tools.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
            {def && <small>{def.description}</small>}
          </label>
          {props.map(([k, v]) => {
            const required = def?.inputSchema.required?.includes(k);
            const label = `${k}${required ? "" : " (optional)"}`;
            if (v.type === "boolean")
              return (
                <label key={k} className="row small">
                  <input type="checkbox" checked={args[k] === true} onChange={(e) => setArgs((a) => ({ ...a, [k]: e.target.checked }))} /> {label}
                  {v.description && <span className="muted"> · {v.description}</span>}
                </label>
              );
            return (
              <label key={k} className="field">
                <span>{label}</span>
                {LONG_FIELDS.test(k) ? (
                  <textarea className="textarea" rows={5} value={String(args[k] ?? "")} onChange={(e) => setArgs((a) => ({ ...a, [k]: e.target.value }))} placeholder={k === "text" || k === "commentary" ? `${detail.project.name} is live! …` : undefined} />
                ) : (
                  <input className="input" value={String(args[k] ?? "")} onChange={(e) => setArgs((a) => ({ ...a, [k]: e.target.value }))} />
                )}
                {v.description && <small>{v.description}</small>}
              </label>
            );
          })}
          <div className="row">
            <button
              className="btn btn-primary"
              disabled={!tool || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const { run } = await api<{ run: WorkflowRun }>(`/api/projects/${id}/workflows`, { method: "POST", body: { kind: "social_post", tool, args } });
                  onProposed(run);
                  toast("Proposed. The post goes out only after approval.");
                } catch (e) {
                  toast(e instanceof Error ? e.message : String(e), "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Propose post
            </button>
            <span className="small muted">Publishes immediately once approved, and is never retried automatically.</span>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------- runs

export function RunCard({ run, onChange, canDecide, showProject }: { run: WorkflowRun; onChange: (r: WorkflowRun) => void; canDecide: boolean; showProject?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pr = run.result?.pr as { url: string; number: number; state: string } | undefined;
  const files = (run.input.files as { path: string; content: string }[] | undefined) ?? [];
  const post = run.kind === "socialbrewery.post" ? (run.input as { tool: string; args: Record<string, unknown> }) : null;

  const doAction = async (action: string) => {
    if (action === "approve") {
      const what = run.kind === "github.pull_request" ? `open a pull request adding ${files.length} file(s) on a new branch` : `publish this post via ${post?.tool} immediately`;
      if (!window.confirm(`Approve and run now? This will ${what}.`)) return;
    }
    setBusy(action);
    setError(null);
    try {
      const { run: next } = await api<{ run: WorkflowRun }>(`/api/workflows/${run.id}`, { method: "POST", body: { action } });
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="run">
      <header className="row">
        <span className={`badge ${STATUS_CLASS[run.status]}`}>{RUN_STATUS_LABEL[run.status]}</span>
        <strong style={{ flex: 1, minWidth: 0 }}>{run.title}</strong>
        <span className="small muted">
          {RUN_KIND_LABEL[run.kind]}
          {showProject ? ` · ${showProject}` : ""} · {ago(run.createdAt)}
        </span>
      </header>

      {files.length > 0 && (
        <div className="run-body">
          {files.map((f) => (
            <details key={f.path} className="file-preview">
              <summary className="mono">{f.path}</summary>
              <pre>{f.content}</pre>
            </details>
          ))}
        </div>
      )}
      {post && (
        <div className="run-body">
          <div className="post-preview">
            <div className="small muted mono">{post.tool}</div>
            {Object.entries(post.args).map(([k, v]) => (
              <div key={k} className="small">
                <span className="muted">{k}: </span>
                <span style={{ whiteSpace: "pre-wrap" }}>{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pr && (
        <p className="small">
          <a href={pr.url} target="_blank" rel="noreferrer">
            Pull request #{pr.number} ↗
          </a>{" "}
          · <span className={`badge ${pr.state === "merged" ? "b-verified" : pr.state === "open" ? "b-recommended" : "b-not_applicable"}`}>{pr.state}</span>
          {pr.state === "merged" && <span className="muted"> · Re-assess to update readiness.</span>}
        </p>
      )}
      {run.status === "succeeded" && typeof run.result?.output === "string" && <pre className="run-output">{run.result.output}</pre>}
      {run.error && <div className="notice error small">{run.error}</div>}
      {error && <div className="notice error small">{error}</div>}

      <footer className="row">
        {run.status === "pending_approval" && canDecide && (
          <>
            <button className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => doAction("approve")}>
              {busy === "approve" ? "Running…" : "Approve and run"}
            </button>
            <button className="btn btn-sm" disabled={!!busy} onClick={() => doAction("reject")}>
              Reject
            </button>
          </>
        )}
        {run.status === "pending_approval" && (
          <button className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => doAction("cancel")}>
            Cancel
          </button>
        )}
        {run.status === "pending_approval" && !canDecide && <span className="small muted">Waiting for an admin to approve.</span>}
        {run.status === "failed" && IDEMPOTENT[run.kind] && canDecide && (
          <button className="btn btn-sm" disabled={!!busy} onClick={() => doAction("retry")}>
            Retry safely
          </button>
        )}
        {run.status === "failed" && !IDEMPOTENT[run.kind] && <span className="small muted">Posts are never retried automatically. Check SocialBrewery before proposing again.</span>}
        {pr && (
          <button className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => doAction("refresh")}>
            Check PR status
          </button>
        )}
      </footer>
    </article>
  );
}

export default function WorkflowsView() {
  const { id, params, go, role } = useProject();
  const [runs, setRuns] = useState<WorkflowRun[] | null>(null);
  const composer = params.get("generate") || params.get("compose") === "pr" ? "pr" : params.get("post") || params.get("compose") === "post" ? "post" : null;

  const load = useCallback(() => api<{ runs: WorkflowRun[] }>(`/api/projects/${id}/workflows`).then((r) => setRuns(r.runs), () => setRuns([])), [id]);
  useEffect(() => {
    load();
  }, [load]);

  const upsert = (r: WorkflowRun) => setRuns((rs) => [r, ...(rs ?? []).filter((x) => x.id !== r.id)]);
  const canDecide = role !== "member";

  return (
    <div className="stack">
      <div className="row">
        <p className="small muted" style={{ flex: 1 }}>
          Actions that change something outside ProductRoot (a pull request, a published post) are proposed first and run only after an admin approves. Every step is recorded in Activity.
        </p>
        <button className="btn" onClick={() => go("workflows", { compose: "pr" })}>
          New pull request
        </button>
        <button className="btn" onClick={() => go("workflows", { compose: "post" })}>
          New launch post
        </button>
      </div>

      {composer === "pr" && <PullRequestComposer onProposed={(r) => (upsert(r), go("workflows"))} onClose={() => go("workflows")} />}
      {composer === "post" && <PostComposer onProposed={(r) => (upsert(r), go("workflows"))} onClose={() => go("workflows")} />}

      {!runs ? (
        <p className="muted">Loading…</p>
      ) : runs.length === 0 ? (
        <div className="card empty">
          <h2>No workflow runs yet</h2>
          <p>Generate a pull request for missing files, or draft a launch post.</p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {runs.map((r) => (
            <RunCard key={r.id} run={r} onChange={upsert} canDecide={canDecide} />
          ))}
        </div>
      )}
    </div>
  );
}
