# ProductRoot

Launch readiness for developers. Connect a GitHub repository and/or a production URL. ProductRoot reads them (read-only), runs deterministic readiness checks, and turns the results into a prioritised launch plan: launch blockers, recommended and optional items, each with the evidence behind it.

ProductRoot sits beside its siblings: **MetaInfo** handles SEO and AI-search discoverability, and **SocialBrewery** handles social launch posts. It reuses them through their own APIs instead of rebuilding them.

- Product plan: [`product-launch-and-operations-hub-plan.md`](product-launch-and-operations-hub-plan.md)
- Plan audit, sibling capability inventory and decisions: [`docs/AUDIT.md`](docs/AUDIT.md)

## What works today (Milestones 1–6)

**Assess and plan (M1–2)**
- **Projects:** each project has a repository and/or production URL, product type, stage, monetisation, country, business type and an automatic re-check toggle. Projects are scoped to the Clerk organisation or personal workspace.
- **Assessment:** reads three sources in parallel; a source that fails never fails the run.
  - GitHub: file tree plus `package.json`. Private repos work once the workspace connects GitHub.
  - Website: status, final URL, security headers, links and scripts, behind an SSRF guard.
  - MetaInfo: `/api/report?format=summary`.
  - Uptime monitors, when one is connected.
- **About 33 deterministic checks.** Evidence states are verified, detected, confirmed, needs confirmation, missing and not applicable.
- **Priorities follow the context** and are recomputed on read. Decisions (done, skip, not applicable, reopen) survive re-assessment, and a regression reopens a task.

**Providers (M3)**
- **Sourced catalog:** 26 providers across payments, auth, hosting, error tracking, uptime, email and analytics (`lib/core/catalog-data.ts`). Every changeable fact links to the official page it came from, and each provider has a `verifiedAt` date. Entries older than 90 days are flagged.
- **Deterministic comparison:**
  - Eligibility by seller country and business type. Unknown facts show as "unknown"; they're never guessed.
  - Fit: already in your code, official SDK for your framework, merchant-of-record status, and setup effort.
  - Price is shown but never used alone to rank.
- **Choices:** you can record the provider you pick for each capability.

**Connections and integrations (M4)**
- **Per-workspace connections**, encrypted with AES-256-GCM using the workspace and provider as AAD, and removable at any time:
  - GitHub: fine-grained token for private repos and pull requests.
  - SocialBrewery: URL plus MCP connector token.
  - UptimeRobot (v3 API) or Better Stack: read-only key.
- **Credentials are checked with the provider before they're stored**, and the browser never sees them again.

**Workflows with approvals (M5)**
- **Pull requests:** generators (CI workflow, LICENSE, SECURITY.md, CONTRIBUTING.md, issue templates, CHANGELOG) preview their exact files before you propose.
  - An approved run opens a PR on a new `productroot/*` branch.
  - It never overwrites a file and never touches the default branch.
  - It's idempotent per branch, so failed runs can be retried safely.
- **SocialBrewery posts:** forms are generated from the tool's JSON schema. Posts run exactly once after approval and are **never** retried, because SocialBrewery has no idempotency keys.
- **Every transition is an audited compare-and-set update.** Only admins approve.
- **Approvals inbox** for the whole workspace.

**Post-launch operations (M6)**
- **Scheduled re-checks:** the Workers cron runs `worker.ts` → `/api/cron/recheck`, which re-assesses stale projects. A check that was verified or detected and is now missing raises a notification.
- **Uptime verification:** a connected monitor must cover the production host and report it up.
- **In-app notifications** for regressions, approvals, and failed or finished runs.

**UI**
- **Launch map:** an xyflow diagram of the plan. Phases run Foundations → Product → Trust → Launch, then a Launch-ready gate fed by every blocker, then Operate. Dependency edges are coloured by whether the path is clear, and clicking a node opens its task.
- **Project workspace tabs:** Overview, Plan, Providers, Workflows, Activity and Settings.

Not yet done:
- A GitHub App flow; fine-grained tokens are used instead.
- Email or Slack delivery of notifications.
- Payment and product-usage metrics.
- AI-written explanations; all findings are deterministic.

## Stack

Same as MetaInfo: Next 16 + React 19 on Cloudflare Workers via OpenNext, D1, and Clerk. Styling is plain CSS tokens shared with MetaInfo, using a violet accent. Tests use Vitest.

## Develop

```bash
npm install
cp .env.example .env.local     # all optional for local use
npm run db:migrate:local       # creates the local D1 under .wrangler/state
npm run dev
```

Without Clerk keys, `next dev` runs as a single local user ("Local mode"); production refuses unauthenticated requests. Set `METAINFO_URL` to include discoverability checks, and `GITHUB_TOKEN` to raise GitHub's 60 requests/hour anonymous limit.

```bash
npm test          # vitest: checks, plan, catalog, generators, workflows, launch map, PR flow (mocked)
npm run typecheck
npm run lint
```

## Deploy

```bash
npx wrangler d1 create productroot   # paste the id into wrangler.jsonc
npm run db:migrate:remote
npx wrangler secret put CLERK_SECRET_KEY
npx wrangler secret put PRODUCTROOT_MASTER_KEY   # encrypts connections; `openssl rand -base64 32`
npx wrangler secret put CRON_SECRET              # guards /api/cron/recheck
# optional: GITHUB_TOKEN (anonymous fallback for public repos), METAINFO_TOKEN
npm run deploy
```

Live at https://productroot.agarwal-aman041.workers.dev (D1 `productroot`, APAC; cron every 2 hours).

Put `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (and, for convenience, `CLERK_SECRET_KEY`) in the git-ignored `.env.production`. The publishable key is inlined at build time. `scripts/cf-sanitize-env.mjs` strips everything else from the build output, so the secret key must also be set with `wrangler secret put`. On `*.workers.dev`, use the Clerk Development instance keys (`pk_test_`/`sk_test_`): production instances need a domain you own. Use the same Clerk application as MetaInfo and SocialBrewery for one sign-in across the family, and add ProductRoot's origin to its allowed origins.

## Layout

```
lib/core/       pure domain logic (checks, plan, catalog, generators, workflow state machine, launch-map layout): unit tested
lib/server/     auth (Clerk), D1 store, safe fetch, collectors, encrypted connections, adapters, workflows, notifications
worker.ts       Worker entry: OpenNext fetch handler + cron trigger
app/api/        JSON route handlers
app/, components/  UI
migrations/     D1 schema
test/           Vitest
```
