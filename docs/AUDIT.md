# ProductRoot: plan audit and sibling capability inventory

Audit of `product-launch-and-operations-hub-plan.md` against the two existing
products it says to reuse, MetaInfo and SocialBrewery, as they stand on
2026-10-15 (`metainfo@2898602` plus an uncommitted Clerk migration,
`socialbrewery@1d08289`). The plan's working name is now **ProductRoot**.

---

## 1. Capability inventory

### MetaInfo (`../metainfo`): website analysis and discoverability

| Area | What exists |
| --- | --- |
| Stack | Next 16 + React 19 on Cloudflare Workers via OpenNext, D1 (`DB`), Rust/WASM analysis engine, optional Python Scrapling render/crawl service. Plain-CSS OKLCH design tokens, no Tailwind. |
| Page audit | 55+ deterministic checks, 0–100 scores for google, bing, chatgpt, perplexity, claude, gemini, social across indexability/meta/social/content/structured/ai/performance. Crawler access matrix (14 bots), robots.txt / sitemap / llms.txt validation, generated `<head>`, JSON-LD, robots.txt, llms.txt, fix plan. |
| AEO/GEO | Deterministic "AI citation readiness" (no LLM). |
| Schema | JSON-LD / Microdata / RDFa validation against schema.org + Google rich results. |
| Research (needs DataForSEO) | Keywords, gap, competitors, SERP + AI Overview, backlinks, rank tracking, AI-engine brand visibility. |
| Machine interfaces | `GET /api/report?url=&format=summary&min=` (CI-friendly, 422 below `min`), `GET /api/schema`, `POST /api/crawl`, `/api/research/*`, and an MCP server at `POST /api/mcp` with `audit_page`, `validate_schema` (free) plus paid research tools. |
| Auth | Scan/report/schema/page/render/crawl: **none**. Research + MCP: single shared `RESEARCH_TOKEN`. Accounts: Clerk (session JWT, no middleware). |
| Persistence | D1 `workspace` table holds opaque per-browser-key JSON blobs; scan history is client-side localStorage unless synced. |
| Gaps | No per-caller API keys, quotas or rate limits; no server-side scan history; no webhooks or scheduled jobs; crawl is a synchronous blob; README/.env docs stale after the Clerk move; no JS tests. |

### SocialBrewery (`../socialbrewery`): social content and publishing

| Area | What exists |
| --- | --- |
| Stack | Plain `node:http` server (zero runtime deps) + Vite/React 19/Tailwind 4/shadcn SPA; runs on Node or as a Cloudflare Worker with D1 document storage. `node --test`. |
| Networks | YouTube Shorts, LinkedIn, Instagram Reels, X, Hashnode, Slack, Reddit (manual mode without approved keys). |
| Generation | Grok captions and 9:16 video clips; Grok/OpenAI video performance reviews; "Brew" chat agent over SSE. |
| Machine interfaces | REST under `/api/*` (Clerk session only), and an MCP connector at `POST /mcp` with ~25 tools (`post_*`, `generate_and_post_*`, `list_*`, `update_*`, `comment_*`, `delete_*`). |
| Auth | Clerk session JWT + active org for REST; per-org `CONNECTOR_TOKEN` (member role) for MCP; platform tokens AES-256-GCM encrypted with org as AAD. |
| Gaps | **No scheduling, queue or cron**: every publish is immediate. No service API keys for REST; platform OAuth is browser-only; no idempotency keys, delete only for X/Reddit, plain `{error}` strings; video-only media; one agent run per org. |

---

## 2. Audit findings on the plan

### Accurate and worth keeping
- The orchestration-layer positioning, evidence states, approval gates, and the
  "assess → prioritise → compare → execute → verify → operate" loop.
- Phase 1 scope (assess and prioritise before integrating anything).
- "Reuse MetaInfo/SocialBrewery through their actual interfaces": both expose
  MCP servers, which makes a common adapter realistic.

### Corrections
1. **SocialBrewery is not a scheduler.** The plan (§1, §5) says "do not
   implement a second social scheduler". There is no first one. Publishing is
   immediate and irreversible. Consequences:
   - Every SocialBrewery `post_*` / `generate_and_post_*` call from ProductRoot
     is a *publishing* action. It needs explicit approval and an audit event.
   - Launch-day scheduling, if wanted, belongs in SocialBrewery (a cron + queue
     feature there), not in ProductRoot.
2. **Evidence states are inconsistent.** §2 promises "detected, user-confirmed,
   and externally verified", but §4 Step 2 lists five states without
   *user-confirmed*. ProductRoot adds **Confirmed** (the user attested it) and
   keeps it distinct from **Verified** (a test, provider API or live HTTP
   check proved it). Manual completion must never produce "Verified".
3. **Website metadata/SEO checks already exist.** Assessment §4 Step 2
   ("landing page and basic web metadata") and module F overlap MetaInfo's
   engine. ProductRoot must not re-implement meta/robots/sitemap/schema/llms
   checks; it calls MetaInfo `/api/report?format=summary` and maps the result
   into its own evidence. ProductRoot's own website checks cover only what
   MetaInfo doesn't: reachability, HTTPS, security headers, legal, pricing and
   support pages.
4. **Integration contract needs a capability matrix per adapter.** "Connect"
   does not mean the same thing for each:
   - MetaInfo: URL plus an optional shared token, no per-user OAuth.
   - SocialBrewery: connector token (member role only). It cannot connect
     networks or change settings, so "connect LinkedIn" stays a *guided*
     action that deep-links to SocialBrewery's dashboard.
   - GitHub: public repos need no auth (60 req/h unauthenticated). Private repos
     need a GitHub App or OAuth, which is a Phase 3 item.

### Gaps the plan doesn't cover
5. **SSRF.** ProductRoot fetches user-supplied URLs. Mirror MetaInfo: Workers
   flag `global_fetch_strictly_public`, plus a literal-IP / localhost guard for
   `next dev`.
6. **Re-assessment must preserve user decisions.** Tasks are keyed by a stable
   check id, and user status (skipped / not applicable / done / chosen
   provider) lives separately from machine results. A re-run updates
   evidence without wiping decisions, and a regression (a previously verified
   check now failing) reopens the task.
7. **Shared identity across the three products.** All three use Clerk. Using
   one Clerk application gives SSO, and lets SocialBrewery REST
   accept ProductRoot users' session tokens (authorised parties must
   include each origin). Without that, only the MCP connector token works
   machine-to-machine.
8. **Upstream hardening ProductRoot depends on** (raise in those repos, not
   here):
   - MetaInfo's report endpoints are unauthenticated with no rate limits.
     ProductRoot should send a service token once MetaInfo supports one.
   - MetaInfo's Clerk vars are missing from `.env.example` and
     `cloudflare-env.d.ts`.
   - SocialBrewery has no idempotency keys, so ProductRoot must not
     auto-retry publishing calls.
9. **Rate limits and quotas** for GitHub API, MetaInfo and SocialBrewery should
   be part of each adapter's error model (retryable vs not).
10. **Provider facts will rot.** The catalog (Phase 2) needs `sourceUrl` +
    `verifiedAt` on every fact from day one. Stale facts (> 90 days) are shown
    as unverified.

---

## 3. Decisions taken (plan §14 defaults, made concrete)

| Decision | Choice | Why |
| --- | --- | --- |
| Audience | Solo devs / small teams launching web SaaS; open-source projects supported through context rules (billing → N/A). | Plan default; Journey B needs only rule changes. |
| Stack ProductRoot runs on | Next 16 + React 19 + OpenNext on Cloudflare Workers, D1, Clerk. | Identical to MetaInfo, so it gets the same deploy, auth and design language. |
| Stack ProductRoot *assesses* first | JavaScript/TypeScript web apps (package.json ecosystems), Next.js in particular; others get generic checks. | Reliable detection beats broad detection. |
| First market | Not hard-coded. Country is captured; business/payment guidance is deferred to Phase 2's sourced catalog. | Avoid guessing eligibility. |
| Automation boundary | Phase 1 is read-only: no PRs, no publishing. | Plan default. |
| Connection model | GitHub: public REST (optional server `GITHUB_TOKEN`). MetaInfo: REST summary. SocialBrewery: MCP connector token (discover only until approvals ship). | Matches what each actually exposes. |
| Data retention | Store derived evidence (detected deps, file paths, HTTP status/headers), never file contents or page HTML. | Minimum data. |
| Design | MetaInfo's token system (OKLCH, cobalt accent, light/dark). | Product-family consistency. |

---

## 4. Build order (status 2026-10-15: M1–M6 built)

Decisions taken while building M3–M6:
- **GitHub auth:** a fine-grained personal access token per workspace (encrypted). It is simpler to self-host than a GitHub App and supports least privilege per repository. A GitHub App remains an option for a hosted multi-tenant version.
- **SocialBrewery is connected per workspace, not with a server-wide env token.** A connector token belongs to one SocialBrewery organisation, so a global token would let every workspace post as it.
- **Uptime APIs:** UptimeRobot is integrated through its current v3 API; v2 is legacy. Better Stack uses `incidents.betterstack.com/api/v2/monitors`.
- **Provider facts found during research that change recommendations:**
  - Lemon Squeezy is transitioning into Stripe Managed Payments.
  - Auth.js now recommends Better Auth for new projects.
  - Razorpay supports MY/SG/US sellers as well as India.
  - Dodo decides eligibility by the country that issued your ID.
  - Vercel Hobby is non-commercial only.
  - Fly.io and Plausible have no ongoing free tier.



- **M1 + M2 (this pass):**
  - Project onboarding (repo URL, site URL, product type, stage, monetisation, country).
  - Evidence collectors (GitHub, website, MetaInfo).
  - Stack detection, deterministic readiness checks and the task catalog with dependencies.
  - Readiness dashboard with priority classes, evidence, and confirm / skip / not-applicable / reopen.
  - Unit tests for classification, context rules and dependencies.
- **M3:** provider catalog with sourced facts and eligibility filters.
- **M4:**
  - Adapter contract implementations: MetaInfo, SocialBrewery (MCP), GitHub App.
  - Connection management with encrypted credentials (same AES-GCM + AAD pattern as SocialBrewery).
- **M5:** workflow runs + approvals + audit log; PR generation.
- **M6:** scheduled re-checks (Workers cron), notifications, post-launch metrics.
