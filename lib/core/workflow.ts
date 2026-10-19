// Workflow run state machine. A consequential action is proposed, explicitly
// approved (or rejected/cancelled), executed once, and its outcome recorded.
//
//   pending_approval ──approve──▶ running ──▶ succeeded | failed
//          │                                        │
//          ├──reject──▶ rejected                    └─retry (PRs only)─▶ running
//          └──cancel──▶ cancelled
//
// Retrying is allowed only for idempotent kinds. Opening a PR is idempotent
// per branch; posting to SocialBrewery is not (no idempotency keys there),
// so a failed post must be checked by hand and proposed again.

import type { Role } from "./roles";

export type RunKind = "github.pull_request" | "socialbrewery.post";
export type RunStatus = "pending_approval" | "rejected" | "running" | "succeeded" | "failed" | "cancelled";
export type RunAction = "approve" | "reject" | "cancel" | "retry";

export const RUN_KIND_LABEL: Record<RunKind, string> = { "github.pull_request": "Pull request", "socialbrewery.post": "Social post" };
export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  pending_approval: "Awaiting approval",
  rejected: "Rejected",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const IDEMPOTENT: Record<RunKind, boolean> = { "github.pull_request": true, "socialbrewery.post": false };

export interface WorkflowRun {
  id: string;
  projectId: string;
  kind: RunKind;
  checkId: string | null;
  title: string;
  input: Record<string, unknown>;
  status: RunStatus;
  requestedBy: string;
  decidedBy: string | null;
  decidedAt: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

const ROLE_RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 };

export type Transition = { ok: true; from: RunStatus; to: RunStatus } | { ok: false; error: string; status: number };

export function transition(run: Pick<WorkflowRun, "kind" | "status" | "requestedBy">, action: RunAction, actor: { userId: string; role: Role }): Transition {
  const admin = ROLE_RANK[actor.role] >= ROLE_RANK.admin;
  switch (action) {
    case "approve":
    case "reject":
      if (!admin) return { ok: false, error: "Only workspace admins can approve or reject actions.", status: 403 };
      if (run.status !== "pending_approval") return { ok: false, error: `This run is ${RUN_STATUS_LABEL[run.status].toLowerCase()}, not awaiting approval.`, status: 409 };
      return { ok: true, from: "pending_approval", to: action === "approve" ? "running" : "rejected" };
    case "cancel":
      if (!admin && actor.userId !== run.requestedBy) return { ok: false, error: "Only the requester or an admin can cancel this.", status: 403 };
      if (run.status !== "pending_approval") return { ok: false, error: "Only runs awaiting approval can be cancelled.", status: 409 };
      return { ok: true, from: "pending_approval", to: "cancelled" };
    case "retry":
      if (!admin) return { ok: false, error: "Only workspace admins can retry.", status: 403 };
      if (run.status !== "failed") return { ok: false, error: "Only failed runs can be retried.", status: 409 };
      if (!IDEMPOTENT[run.kind])
        return { ok: false, error: "Posts are never retried automatically: the post may have gone out before the error. Check SocialBrewery, then propose a new post if needed.", status: 409 };
      return { ok: true, from: "failed", to: "running" };
  }
}

/** Short stable hash for idempotency keys (not for security). */
export function stableHash(value: unknown): string {
  const s = JSON.stringify(value, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));
  let h1 = 0xdeadbeef ^ s.length;
  let h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
