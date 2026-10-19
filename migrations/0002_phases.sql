-- Phase 2–4: business context, provider choices, encrypted connections,
-- approval-gated workflow runs, scheduled re-checks and notifications.

ALTER TABLE projects ADD COLUMN business_type TEXT NOT NULL DEFAULT 'undecided'; -- individual | sole_proprietor | company | undecided
ALTER TABLE projects ADD COLUMN recheck INTEGER NOT NULL DEFAULT 1;               -- scheduled re-assessment on/off

-- The provider the user picked for a capability (payments, auth, ...).
CREATE TABLE provider_choices (
  project_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  chosen_by TEXT NOT NULL,
  chosen_at TEXT NOT NULL,
  PRIMARY KEY (project_id, capability)
);

-- Per-workspace credentials. `secret` is AES-256-GCM ciphertext (base64,
-- workspace + provider bound as AAD); `meta` is non-secret JSON (login,
-- scopes, endpoint) safe to return to the browser.
CREATE TABLE connections (
  owner TEXT NOT NULL,
  provider TEXT NOT NULL,             -- github | socialbrewery | uptimerobot | betterstack
  secret TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ok',  -- ok | error
  status_message TEXT NOT NULL DEFAULT '',
  connected_by TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  checked_at TEXT,
  PRIMARY KEY (owner, provider)
);

-- A consequential action: proposed, then approved or rejected, then executed
-- at most once. `idempotency_key` stops duplicate proposals for the same thing.
CREATE TABLE workflow_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  kind TEXT NOT NULL,                 -- github.pull_request | socialbrewery.post
  check_id TEXT,
  title TEXT NOT NULL,
  input TEXT NOT NULL,                -- JSON; never contains secrets
  status TEXT NOT NULL,               -- pending_approval | rejected | running | succeeded | failed | cancelled
  idempotency_key TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  decided_by TEXT,
  decided_at TEXT,
  result TEXT,                        -- JSON
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX workflow_idem ON workflow_runs (owner, idempotency_key);
CREATE INDEX workflow_project ON workflow_runs (project_id, created_at DESC);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  project_id TEXT,
  kind TEXT NOT NULL,                 -- regression | recheck_failed | approval_needed | workflow_failed | stale
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX notifications_owner ON notifications (owner, created_at DESC);
