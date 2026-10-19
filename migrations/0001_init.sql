-- ProductRoot core schema. `owner` is the Clerk organisation id, or the user id
-- for a personal workspace. Stored data is derived evidence only: dependency
-- names, file paths, HTTP status and headers. Never file contents or page HTML.

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  repo_url TEXT,
  site_url TEXT,
  product_type TEXT NOT NULL,
  stage TEXT NOT NULL,
  monetization TEXT NOT NULL,
  country TEXT,
  stack TEXT,               -- JSON StackSummary from the latest assessment
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX projects_owner ON projects (owner, updated_at DESC);

-- One row per assessment run. `results` is a JSON array of CheckResult; the
-- plan (priorities, applicability) is derived at read time from the project's
-- current context so editing the context never needs a re-scan.
CREATE TABLE assessments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  sources TEXT NOT NULL,    -- JSON SourceStatus[]
  results TEXT NOT NULL,    -- JSON CheckResult[]
  started_by TEXT NOT NULL
);
CREATE INDEX assessments_project ON assessments (project_id, started_at DESC);

-- User decisions survive re-assessment: keyed by stable check id.
CREATE TABLE decisions (
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  check_id TEXT NOT NULL,
  status TEXT NOT NULL,     -- done | skipped | not_applicable
  note TEXT NOT NULL DEFAULT '',
  decided_by TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  PRIMARY KEY (project_id, check_id)
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  owner TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '{}',
  at TEXT NOT NULL
);
CREATE INDEX audit_owner ON audit_events (owner, at DESC);
CREATE INDEX audit_project ON audit_events (project_id, at DESC);
