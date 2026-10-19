// The readiness check catalog. Each check has two halves:
// - `priority(ctx)`: does it apply to this product, and how much does it matter?
// - `evaluate(signals)`: what does the evidence say? Context-independent, so
//   the result can be stored and re-prioritised when the context changes.
//
// Rule of thumb for states: "missing" only when the check *is* a presence
// check over a source we actually read in full (a file in the tree, a link on
// the fetched homepage). When a capability could be implemented in a way we
// can't see (custom auth, dashboard-configured hosting), say
// "needs_confirmation" and ask.

import type { LinkInfo, Signals } from "./signals";
import { AUTH_PROVIDERS, BILLING_PROVIDERS, HOSTING, MANAGED_AUTH, matching } from "./stack";
import type { CheckResult, Evidence, Priority, ProductContext } from "./types";

export type Area = "auth" | "payments" | "legal" | "infra" | "security" | "quality" | "operations" | "growth" | "support" | "opensource";

export const AREA_LABEL: Record<Area, string> = {
  auth: "Accounts & auth",
  payments: "Payments",
  legal: "Legal & trust",
  infra: "Deploy & infrastructure",
  security: "Security",
  quality: "Quality",
  operations: "Operations",
  growth: "Growth & discoverability",
  support: "Support",
  opensource: "Open source",
};

/** Sibling products that can do (part of) the work. */
export type Tool = "metainfo" | "socialbrewery";

export interface CheckDef {
  id: string;
  area: Area;
  title: string;
  why: string;
  recommendation: string;
  effort: "minutes" | "hours" | "days";
  /** How completion can be verified. */
  verify: string;
  /** Asked when the result needs confirmation. */
  question: string;
  dependsOn?: string[];
  tools?: Tool[];
  priority(ctx: ProductContext): Priority | null;
  evaluate(s: Signals): Omit<CheckResult, "id">;
}

// ----------------------------------------------------------------- helpers

const PRE_LAUNCH = new Set(["prototype", "working", "beta"]);
const preLaunch = (c: ProductContext) => PRE_LAUNCH.has(c.stage);
const live = (c: ProductContext) => !preLaunch(c);
const paid = (c: ProductContext) => c.monetization === "one_time" || c.monetization === "subscription" || c.monetization === "usage";
const recurring = (c: ProductContext) => c.monetization === "subscription" || c.monetization === "usage";
const userFacing = (c: ProductContext) => c.productType === "saas" || c.productType === "api" || c.productType === "mobile";

const result = (state: CheckResult["state"], summary: string, evidence: Evidence[] = []) => ({ state, summary, evidence });

const NO_REPO = "No repository was assessed. Connect one to check this automatically, or confirm it yourself.";
const NO_SITE = "No website was assessed. Add your production URL to check this automatically, or confirm it yourself.";

const filesMatching = (s: Signals, re: RegExp, limit = 5) => (s.repo ? s.repo.files.filter((f) => re.test(f)).slice(0, limit) : []);
const fileEvidence = (paths: string[], detail: string): Evidence[] => paths.map((ref) => ({ source: "github", ref, detail }));

const depsMatching = (s: Signals, names: string[]) =>
  s.repo ? Object.keys(s.repo.deps).filter((d) => names.some((n) => (n.endsWith("/") ? d.startsWith(n) : d === n))) : [];
const depEvidence = (deps: string[], detail: string): Evidence[] => deps.map((ref) => ({ source: "github", ref, detail }));

/** Route-like files: app/pages/routes directories in common frameworks. */
const routeFiles = (s: Signals, word: RegExp, limit = 5) =>
  s.repo ? s.repo.files.filter((f) => /(^|\/)(app|pages|routes|src\/(app|pages|routes)|views|screens)\//.test(f) && word.test(f)).slice(0, limit) : [];

const linksMatching = (s: Signals, re: RegExp): LinkInfo[] => (s.site ? s.site.links.filter((l) => re.test(l.href) || re.test(l.text)) : []);
const linkEvidence = (links: LinkInfo[], detail: string): Evidence[] =>
  links.slice(0, 3).map((l) => ({ source: "website", ref: l.href, detail: `${detail}${l.text ? ` ("${l.text}")` : ""}` }));

const siteOk = (s: Signals) => !!s.site && s.site.status < 400;

/** Repo presence check: detected if any file matches, otherwise missing (or needs confirmation when the tree was truncated). */
function presence(s: Signals, re: RegExp, found: string, absent: string): Omit<CheckResult, "id"> {
  if (!s.repo) return result("needs_confirmation", NO_REPO);
  const hits = filesMatching(s, re);
  if (hits.length) return result("detected", found, fileEvidence(hits, "File present"));
  if (s.repo.truncated) return result("needs_confirmation", `${absent} The repository listing was truncated, so this may be a false negative.`);
  return result("missing", absent, [{ source: "github", ref: `${s.repo.owner}/${s.repo.repo}@${s.repo.branch}`, detail: "Searched every file path in the default branch" }]);
}

/** Website link check with repo route fallback. Missing only when the homepage was fetched and the repo (if any) has no matching route. */
function pageLink(s: Signals, linkRe: RegExp, routeRe: RegExp, what: string): Omit<CheckResult, "id"> {
  const links = linksMatching(s, linkRe);
  const routes = routeFiles(s, routeRe);
  const evidence = [...linkEvidence(links, "Linked from the homepage"), ...fileEvidence(routes, "Route file")];
  if (evidence.length) return result("detected", `Found a ${what}.`, evidence);
  if (siteOk(s)) {
    const searched: Evidence[] = [{ source: "website", ref: s.site!.finalUrl, detail: `Checked ${s.site!.links.length} homepage links` }];
    if (s.repo) searched.push({ source: "github", ref: `${s.repo.owner}/${s.repo.repo}`, detail: "Checked route files" });
    return result("missing", `No ${what} is linked from the homepage.`, searched);
  }
  return result("needs_confirmation", s.repo ? `No ${what} route found in the repository; it may live on a separate site.` : NO_SITE);
}

// ------------------------------------------------------------------ catalog

export const CHECKS: CheckDef[] = [
  // ---------------------------------------------------------------- auth
  {
    id: "auth.present",
    area: "auth",
    title: "User accounts and sign-in",
    why: "Paid and personalised products need a reliable way to identify users. Rolling your own auth is a common source of security bugs.",
    recommendation: "Keep the auth you have if it works. If there is none, a hosted provider compatible with your framework is usually the fastest safe option.",
    effort: "hours",
    verify: "Sign up, sign out and sign back in on production with a fresh account.",
    question: "Does the product have user accounts, and how do people sign in?",
    priority: (c) => (c.productType === "saas" ? (paid(c) ? "blocker" : "recommended") : c.productType === "api" || c.productType === "mobile" ? "recommended" : null),
    evaluate(s) {
      const providers = s.repo ? matching(AUTH_PROVIDERS, s.repo) : [];
      const deps = depsMatching(s, ["@clerk/", "next-auth", "@auth/core", "better-auth", "lucia", "@supabase/ssr", "@supabase/auth-helpers-nextjs", "firebase", "@auth0/", "@kinde-oss/", "@workos-inc/", "@stackframe/", "passport", "@ory/", "@convex-dev/auth"]);
      if (providers.length) return result("detected", `Uses ${providers.join(", ")}.`, depEvidence(deps, "Auth dependency"));
      const routes = routeFiles(s, /(log-?in|sign-?in|sign-?up|register|auth)/i);
      const links = linksMatching(s, /(log ?in|sign ?in|sign ?up|get started)/i);
      const evidence = [...fileEvidence(routes, "Sign-in route"), ...linkEvidence(links, "Homepage link")];
      if (evidence.length) return result("needs_confirmation", "Found sign-in routes or links but no known auth library. Custom auth needs a closer look.", evidence);
      if (!s.repo && !s.site) return result("needs_confirmation", NO_REPO);
      return result("needs_confirmation", "No auth library or sign-in route found. If the product has accounts, they may be implemented in a way this scan can't see.");
    },
  },
  {
    id: "auth.recovery",
    area: "auth",
    title: "Email verification and password reset",
    why: "Users who can't recover their account become support tickets or churn; unverified emails enable abuse and bounce your transactional mail.",
    recommendation: "Hosted auth providers include these flows. With custom auth, add a time-limited reset token flow and verify email before granting full access.",
    effort: "hours",
    verify: "Request a password reset and an email verification for a test account and complete both.",
    question: "Can users verify their email and reset a forgotten password?",
    dependsOn: ["auth.present"],
    priority: (c) => CHECK_BY_ID["auth.present"].priority(c),
    evaluate(s) {
      const managed = s.repo ? matching(AUTH_PROVIDERS, s.repo).filter((p) => MANAGED_AUTH.has(p)) : [];
      if (managed.length) return result("detected", `${managed.join(", ")} provides hosted verification and reset flows. Check they are enabled in its dashboard.`, [{ source: "rule", ref: managed[0], detail: "Managed auth provider" }]);
      if (!s.repo) return result("needs_confirmation", NO_REPO);
      const routes = filesMatching(s, /(forgot|reset)[-_]?password|verify[-_]?email|email[-_]?verification/i);
      if (routes.length) return result("detected", "Found reset or verification code.", fileEvidence(routes, "Recovery flow"));
      return result("needs_confirmation", "No reset or verification flow found in file names.");
    },
  },
  {
    id: "auth.deletion",
    area: "auth",
    title: "Account deletion",
    why: "Users expect to be able to delete their account and data, app stores require it for apps with sign-up, and privacy laws in many regions give users that right.",
    recommendation: "Offer self-serve deletion in account settings that removes or anonymises personal data, including in third-party services.",
    effort: "hours",
    verify: "Delete a test account and confirm its data is gone from the database and connected providers.",
    question: "Can users delete their account themselves?",
    dependsOn: ["auth.present"],
    priority: (c) => (CHECK_BY_ID["auth.present"].priority(c) ? (c.productType === "mobile" ? "blocker" : "recommended") : null),
    evaluate(s) {
      if (!s.repo) return result("needs_confirmation", NO_REPO);
      const hits = filesMatching(s, /delete[-_]?(account|user|me)|account[-_/]delete|close[-_]?account/i);
      if (hits.length) return result("detected", "Found account deletion code.", fileEvidence(hits, "Deletion flow"));
      const providers = matching(AUTH_PROVIDERS, s.repo).filter((p) => MANAGED_AUTH.has(p));
      if (providers.length) return result("needs_confirmation", `${providers[0]}'s account components can offer deletion, but your own database rows also need removing.`);
      return result("needs_confirmation", "No account deletion code found in file names.");
    },
  },
  {
    id: "security.rate_limit",
    area: "security",
    title: "Rate limiting on sign-in and APIs",
    why: "Without limits, sign-in endpoints invite credential stuffing and public APIs can run up your infrastructure bill.",
    recommendation: "Add per-IP and per-account limits on auth and expensive endpoints, either in code or at the edge (WAF rules).",
    effort: "hours",
    verify: "Send repeated requests to a protected endpoint and confirm you get HTTP 429.",
    question: "Are sign-in and API endpoints rate limited, in code or at the edge?",
    priority: (c) => (c.productType === "api" ? "blocker" : c.productType === "saas" ? "recommended" : null),
    evaluate(s) {
      if (!s.repo) return result("needs_confirmation", NO_REPO);
      const deps = depsMatching(s, ["@upstash/ratelimit", "express-rate-limit", "rate-limiter-flexible", "@arcjet/", "hono-rate-limiter", "@nestjs/throttler", "limiter", "@fastify/rate-limit"]);
      if (deps.length) return result("detected", "Rate-limiting library found.", depEvidence(deps, "Rate-limit dependency"));
      const edge = matching(HOSTING, s.repo).filter((h) => h === "Cloudflare" || h === "Vercel");
      return result("needs_confirmation", edge.length ? `No rate-limit library found. ${edge[0]} can enforce limits at the edge; check whether rules are configured.` : "No rate-limit library found.");
    },
  },

  // ------------------------------------------------------------ payments
  {
    id: "billing.provider",
    area: "payments",
    title: "Payment provider",
    why: "You can't charge without one, and provider eligibility depends on your country, business type and what you sell.",
    recommendation: "Choose a provider that accepts your business type and country. Merchants of record handle sales tax for you; payment processors leave it to you.",
    effort: "days",
    verify: "Complete a sandbox purchase end to end and see it in the provider dashboard.",
    question: "Which payment provider will you use, and is your account approved for live payments?",
    priority: (c) => (paid(c) ? "blocker" : c.monetization === "undecided" ? "optional" : null),
    evaluate(s) {
      const providers = s.repo ? matching(BILLING_PROVIDERS, s.repo) : [];
      const deps = depsMatching(s, ["stripe", "@stripe/stripe-js", "@stripe/react-stripe-js", "@paddle/", "@lemonsqueezy/", "@polar-sh/", "chargebee", "chargebee-typescript", "razorpay", "braintree", "react-native-purchases", "@revenuecat/purchases-js", "dodopayments"]);
      const links = linksMatching(s, /(buy\.stripe\.com|checkout\.stripe\.com|lemonsqueezy\.com|paddle\.com|polar\.sh|gumroad\.com)/i);
      const evidence = [...depEvidence(deps, "Payment dependency"), ...linkEvidence(links, "Checkout link")];
      if (evidence.length) return result("detected", providers.length ? `Uses ${providers.join(", ")}.` : "Found hosted checkout links.", evidence);
      if (!s.repo && !s.site) return result("needs_confirmation", NO_REPO);
      return result("needs_confirmation", "No payment SDK or checkout link found. Payment links configured elsewhere would not show up here.");
    },
  },
  {
    id: "billing.webhooks",
    area: "payments",
    title: "Payment webhooks and subscription sync",
    why: "Redirects after checkout are unreliable. Webhooks are how you learn about renewals, failed payments, refunds and cancellations, and keep access in sync.",
    recommendation: "Handle the provider's checkout-completed, subscription-updated/deleted and payment-failed events; verify signatures and make handlers idempotent.",
    effort: "hours",
    verify: "Use the provider's CLI or dashboard to send test events and confirm the user's plan changes.",
    question: "Do you process payment webhooks (renewal, failure, cancellation)?",
    dependsOn: ["billing.provider"],
    priority: (c) => (recurring(c) ? "blocker" : c.monetization === "one_time" ? "recommended" : null),
    evaluate(s) {
      if (!s.repo) return result("needs_confirmation", NO_REPO);
      // Webhook files for other things (social networks, GitHub, Slack) don't count.
      const billingHooks = filesMatching(s, /(webhook[^/]*\/?.*(stripe|paddle|lemon|polar|billing|payment|checkout|subscription|razorpay|chargebee|dodo))|((stripe|paddle|lemon|polar|billing|payment|checkout|subscription|razorpay|chargebee|dodo)[^/]*\/?.*webhook)/i);
      if (billingHooks.length) return result("detected", "Found payment webhook handlers. Check they cover renewal, failure and cancellation events.", fileEvidence(billingHooks, "Payment webhook handler"));
      const provider = matching(BILLING_PROVIDERS, s.repo);
      const anyHooks = filesMatching(s, /webhook/i, 3);
      if (provider.length && anyHooks.length)
        return result("needs_confirmation", `Found webhook handlers and ${provider[0]}, but couldn't tell whether the handlers process payment events.`, fileEvidence(anyHooks, "Webhook handler"));
      return result("needs_confirmation", "No payment webhook handler found in file names.");
    },
  },
  {
    id: "billing.self_service",
    area: "payments",
    title: "Self-serve billing: upgrade, cancel, invoices",
    why: "Making cancellation hard creates chargebacks and, in several regions, legal exposure. Self-serve billing also cuts support load.",
    recommendation: "Link to the provider's hosted customer portal from account settings, or build plan management on its API.",
    effort: "hours",
    verify: "With a test subscription: upgrade, download an invoice and cancel without contacting support.",
    question: "Can customers change plans, see invoices and cancel on their own?",
    dependsOn: ["billing.provider"],
    priority: (c) => (recurring(c) ? "recommended" : null),
    evaluate(s) {
      if (!s.repo) return result("needs_confirmation", NO_REPO);
      const hits = routeFiles(s, /(billing|portal|subscription|plan)/i);
      if (hits.length) return result("detected", "Found billing or subscription routes.", fileEvidence(hits, "Billing route"));
      return result("needs_confirmation", "No billing settings route found.");
    },
  },
  {
    id: "billing.pricing_page",
    area: "payments",
    title: "Pricing page",
    why: "Visitors decide whether to try a paid product based on price. A missing pricing page is a common conversion leak.",
    recommendation: "Publish plans, what each includes, and the trial/refund policy. Link it from the main navigation.",
    effort: "hours",
    verify: "Open the pricing page on mobile and desktop and follow each plan's call to action.",
    question: "Is there a public pricing page?",
    priority: (c) => (paid(c) ? "recommended" : c.monetization === "undecided" ? "optional" : null),
    evaluate: (s) => pageLink(s, /pric|plans/i, /pric|plans/i, "pricing page"),
  },

  // --------------------------------------------------------------- legal
  {
    id: "legal.privacy",
    area: "legal",
    title: "Privacy policy",
    why: "If you collect any personal data (accounts, emails, analytics cookies), many jurisdictions expect a privacy notice. App stores, payment providers and OAuth providers usually require one.",
    recommendation: "Describe what you collect, why, who processes it (list your providers) and how users exercise their rights. This is general guidance, not legal advice.",
    effort: "hours",
    verify: "The policy is linked from the footer and signup, and lists every provider that receives user data.",
    question: "Do you have a privacy policy, and where is it published?",
    priority: (c) => (userFacing(c) ? "blocker" : c.productType === "content" ? "recommended" : "optional"),
    evaluate: (s) => pageLink(s, /privacy/i, /privacy/i, "privacy policy"),
  },
  {
    id: "legal.terms",
    area: "legal",
    title: "Terms of service",
    why: "Terms set expectations on acceptable use, liability, refunds and termination. Payment providers commonly require them before approving live payments.",
    recommendation: "Publish terms covering acceptable use, payment and refund terms, and limitation of liability. Get professional advice for regulated products.",
    effort: "hours",
    verify: "Terms are linked from the footer and accepted at signup or checkout.",
    question: "Do you publish terms of service?",
    priority: (c) => (paid(c) ? "blocker" : userFacing(c) ? "recommended" : "optional"),
    evaluate: (s) => pageLink(s, /terms|\btos\b|conditions|legal/i, /terms|\btos\b|legal/i, "terms of service page"),
  },

  // --------------------------------------------------------------- infra
  {
    id: "site.reachable",
    area: "infra",
    title: "Production site is live",
    why: "Everything else (sign-ups, payments, search indexing) depends on a reachable production URL.",
    recommendation: "Deploy to a host that fits your framework and point your own domain at it.",
    effort: "hours",
    verify: "ProductRoot fetches the URL and expects a non-error response.",
    question: "What is the production URL?",
    priority: (c) => (live(c) || c.stage === "beta" ? "blocker" : "recommended"),
    evaluate(s) {
      if (s.site && s.site.status < 400)
        return result("verified", `Responded with HTTP ${s.site.status}.`, [{ source: "website", ref: s.site.finalUrl, detail: `HTTP ${s.site.status}${s.site.title ? `, title "${s.site.title}"` : ""}` }]);
      if (s.site) return result("missing", `The site responded with HTTP ${s.site.status}.`, [{ source: "website", ref: s.site.finalUrl, detail: `HTTP ${s.site.status}` }]);
      if (s.siteError) return result("missing", `The site couldn't be reached: ${s.siteError}`, [{ source: "website", ref: "", detail: s.siteError }]);
      return result("needs_confirmation", NO_SITE);
    },
  },
  {
    id: "site.https",
    area: "security",
    title: "HTTPS everywhere",
    why: "Browsers flag plain HTTP as insecure, and sign-in cookies and payment pages need TLS.",
    recommendation: "Serve the site over HTTPS and redirect HTTP to HTTPS. Most hosts do this automatically.",
    effort: "minutes",
    verify: "ProductRoot follows redirects and checks the final URL uses https.",
    question: "Is the site served over HTTPS?",
    dependsOn: ["site.reachable"],
    priority: (c) => (userFacing(c) ? "blocker" : "recommended"),
    evaluate(s) {
      if (!s.site) return result("needs_confirmation", NO_SITE);
      const https = s.site.finalUrl.startsWith("https://");
      const ev: Evidence[] = [{ source: "website", ref: s.site.finalUrl, detail: https ? "Final URL is HTTPS" : "Final URL is plain HTTP" }];
      return https ? result("verified", "Served over HTTPS.", ev) : result("missing", "The site ends up on plain HTTP.", ev);
    },
  },
  {
    id: "infra.deploy_config",
    area: "infra",
    title: "Reproducible deployment",
    why: "Deployment configured in the repository can be reviewed, rolled back and reproduced. Dashboard-only setups are easy to lose.",
    recommendation: "Commit your host's config file and deploy from CI or a git integration so every release maps to a commit.",
    effort: "hours",
    verify: "Deploy a no-op change from a clean checkout following only the repository's instructions.",
    question: "How is the app deployed (host, and is it triggered from git)?",
    priority: (c) => (c.productType === "oss" ? "optional" : "recommended"),
    evaluate(s) {
      if (!s.repo) return result("needs_confirmation", NO_REPO);
      const hosts = matching(HOSTING, s.repo);
      const files = filesMatching(s, /(^|\/)(wrangler\.(toml|jsonc?)|vercel\.json|netlify\.toml|fly\.toml|render\.yaml|railway\.(json|toml)|firebase\.json|serverless\.ya?ml|Dockerfile|Procfile|app\.ya?ml)$/);
      if (hosts.length) return result("detected", `Deployment config for ${hosts.join(", ")}.`, fileEvidence(files, "Deployment config"));
      return result("needs_confirmation", "No deployment config file found. Git-integrated hosts (Vercel, Netlify, Cloudflare Pages) may be configured in their dashboard.");
    },
  },
  {
    id: "infra.env_template",
    area: "infra",
    title: "Documented environment variables",
    why: "An example env file is how you (and anyone else) know which secrets production needs. Missing variables are a top cause of broken deploys.",
    recommendation: "Commit a .env.example listing every variable with a comment and no real values.",
    effort: "minutes",
    verify: "Start the app from a clean checkout using only the example file as a guide.",
    question: "Are required environment variables documented?",
    priority: (c) => (c.productType === "saas" || c.productType === "api" ? "recommended" : "optional"),
    evaluate: (s) => presence(s, /(^|\/)(\.env\.(example|sample|template|dist)|\.dev\.vars\.example|env\.example)$/i, "Found an environment template.", "No .env.example (or similar) file found."),
  },
  {
    id: "infra.db_migrations",
    area: "infra",
    title: "Database migrations",
    why: "Schema changes applied by hand drift between environments and are hard to roll back.",
    recommendation: "Use your ORM's migration tool (or plain SQL migrations) and run them as part of deployment.",
    effort: "hours",
    verify: "Create a fresh database from migrations alone and run the app against it.",
    question: "Does the product use a database, and are schema changes tracked as migrations?",
    priority: (c) => (c.productType === "saas" || c.productType === "api" ? "recommended" : "optional"),
    evaluate(s) {
      if (!s.repo) return result("needs_confirmation", NO_REPO);
      const dirs = filesMatching(s, /(^|\/)(migrations|drizzle|db\/migrate|supabase\/migrations|alembic\/versions)\//, 3);
      if (dirs.length) return result("detected", "Found migration files.", fileEvidence(dirs, "Migration"));
      const orm = depsMatching(s, ["prisma", "@prisma/client", "drizzle-orm", "kysely", "typeorm", "sequelize", "knex", "mongoose"]);
      if (orm.length) return result("needs_confirmation", "An ORM is installed but no migration files were found.", depEvidence(orm, "Database dependency"));
      return result("needs_confirmation", "No database or migration files detected. If the product has no database, mark this not applicable.");
    },
  },
  {
    id: "operations.backups",
    area: "operations",
    title: "Database backups and a tested restore",
    why: "A backup you've never restored is a hope, not a backup. Data loss is one of the few mistakes customers don't forgive.",
    recommendation: "Turn on your database host's automated backups or point-in-time recovery, and do one practice restore.",
    effort: "hours",
    verify: "Restore last night's backup into a scratch database and query it.",
    question: "Are database backups automated, and have you tested a restore?",
    priority: (c) => (c.productType === "saas" || c.productType === "api" ? (live(c) ? "blocker" : "recommended") : c.productType === "mobile" ? "recommended" : null),
    evaluate: () => result("needs_confirmation", "Backups are configured at the database host, so this can only be confirmed by you for now."),
  },

  // ------------------------------------------------------------ security
  {
    id: "security.secrets",
    area: "security",
    title: "No secrets committed to the repository",
    why: "Committed .env files and private keys get scraped from repositories within minutes, and remain in git history after deletion.",
    recommendation: "Remove the files, rotate every credential they contained, and add them to .gitignore. Deleting the file alone is not enough.",
    effort: "hours",
    verify: "Re-run the assessment; then rotate keys and confirm old ones are revoked in each provider.",
    question: "Have any secrets ever been committed to this repository?",
    priority: (c) => (c.hasRepo ? "blocker" : null),
    evaluate(s) {
      if (!s.repo) return result("needs_confirmation", NO_REPO);
      const hits = s.repo.files
        .filter((f) => /(^|\/)(\.env(\.(local|production|prod|development|dev|staging))?|\.dev\.vars|id_rsa|id_ed25519|credentials\.json|service[-_]?account[^/]*\.json|[^/]+\.(pem|p12|pfx|key))$/i.test(f))
        .filter((f) => !/(^|\/)(test|tests|fixtures?|__fixtures__|examples?|docs?)\//i.test(f) && !/public[-_.]?key|\.pub$/i.test(f))
        .slice(0, 10);
      if (hits.length) return result("missing", `${hits.length} secret-looking file${hits.length > 1 ? "s" : ""} in the default branch.`, fileEvidence(hits, "Possible secret file"));
      if (s.repo.truncated) return result("needs_confirmation", "The repository listing was truncated, so not every file could be checked.");
      return result("detected", "No .env files, private keys or credential files in the default branch. History and file contents are not scanned.", [
        { source: "github", ref: `${s.repo.owner}/${s.repo.repo}@${s.repo.branch}`, detail: `Checked ${s.repo.files.length} file paths` },
      ]);
    },
  },
  {
    id: "security.headers",
    area: "security",
    title: "Security headers",
    why: "Headers such as HSTS, CSP and frame protection close off whole classes of attacks (downgrade, XSS, clickjacking) for little effort.",
    recommendation: "Set Strict-Transport-Security, Content-Security-Policy, X-Content-Type-Options, Referrer-Policy and frame protection in your framework or host config.",
    effort: "hours",
    verify: "ProductRoot reads the response headers of the production URL.",
    question: "Are security headers configured?",
    dependsOn: ["site.reachable"],
    priority: (c) => (c.productType === "saas" || c.productType === "api" ? "recommended" : "optional"),
    evaluate(s) {
      if (!s.site) return result("needs_confirmation", NO_SITE);
      const h = s.site.headers;
      const csp = h["content-security-policy"] ?? "";
      const checks: [string, boolean][] = [
        ["Strict-Transport-Security", !!h["strict-transport-security"]],
        ["Content-Security-Policy", !!csp],
        ["X-Content-Type-Options", (h["x-content-type-options"] ?? "").toLowerCase() === "nosniff"],
        ["Referrer-Policy", !!h["referrer-policy"]],
        ["Frame protection", !!h["x-frame-options"] || /frame-ancestors/i.test(csp)],
      ];
      const absent = checks.filter(([, ok]) => !ok).map(([n]) => n);
      const evidence: Evidence[] = checks.map(([n, ok]) => ({ source: "website", ref: s.site!.finalUrl, detail: `${n}: ${ok ? "present" : "absent"}` }));
      return absent.length ? result("missing", `${checks.length - absent.length} of ${checks.length} present. Missing: ${absent.join(", ")}.`, evidence) : result("verified", "All five recommended headers are set.", evidence);
    },
  },

  // ------------------------------------------------------------- quality
  {
    id: "quality.tests",
    area: "quality",
    title: "Automated tests",
    why: "Tests on sign-up, checkout and core flows are what let you ship fixes after launch without breaking revenue.",
    recommendation: "Start with a few end-to-end tests of the money path (sign up → pay → use the core feature) rather than chasing coverage.",
    effort: "days",
    verify: "Tests run green in CI on the default branch.",
    question: "Do you have automated tests for the core flows?",
    priority: (c) => (c.productType === "oss" || c.productType === "api" ? "recommended" : c.productType === "content" ? "optional" : "recommended"),
    evaluate(s) {
      if (!s.repo) return result("needs_confirmation", NO_REPO);
      const deps = depsMatching(s, ["vitest", "jest", "mocha", "@playwright/test", "cypress", "ava", "uvu", "@testing-library/react", "jasmine", "node-tap", "tap"]);
      const files = filesMatching(s, /(\.(test|spec)\.[cm]?[jt]sx?$|_test\.(go|py)$|(^|\/)test_[^/]+\.py$|(^|\/)(__tests__|e2e)\/|_spec\.rb$)/, 3);
      const evidence = [...depEvidence(deps, "Test framework"), ...fileEvidence(files, "Test file")];
      if (files.length) return result("detected", "Found test files.", evidence);
      if (deps.length) return result("needs_confirmation", "A test framework is installed but no test files were found.", evidence);
      if (s.repo.truncated) return result("needs_confirmation", "The repository listing was truncated, so test files may have been missed.");
      return result("missing", "No test framework or test files found.", [{ source: "github", ref: `${s.repo.owner}/${s.repo.repo}`, detail: "Searched dependencies and file names" }]);
    },
  },
  {
    id: "quality.ci",
    area: "quality",
    title: "Continuous integration",
    why: "CI catches broken builds before your users do, and is where tests, linting and deploys get enforced.",
    recommendation: "Add a workflow that installs, builds and tests on every pull request.",
    effort: "hours",
    verify: "Open a pull request and see the checks run.",
    question: "Does CI run on pull requests?",
    priority: (c) => (c.productType === "oss" ? "recommended" : c.productType === "content" ? "optional" : "recommended"),
    evaluate: (s) => presence(s, /(^\.github\/workflows\/[^/]+\.ya?ml$|^\.gitlab-ci\.yml$|^\.circleci\/config\.yml$|^azure-pipelines\.yml$|^bitbucket-pipelines\.yml$|^\.buildkite\/)/, "Found CI configuration.", "No CI configuration found."),
  },
  {
    id: "quality.lockfile",
    area: "quality",
    title: "Dependency lockfile",
    why: "Without a lockfile, every install can pull different versions, making bugs irreproducible and supply-chain attacks easier.",
    recommendation: "Commit your package manager's lockfile and use a frozen install in CI.",
    effort: "minutes",
    verify: "CI installs with the frozen/ci flag.",
    question: "Is a dependency lockfile committed?",
    priority: () => "recommended",
    evaluate: (s) =>
      presence(s, /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|poetry\.lock|uv\.lock|Pipfile\.lock|Cargo\.lock|go\.sum|Gemfile\.lock|composer\.lock|pubspec\.lock|mix\.lock)$/, "Found a lockfile.", "No dependency lockfile found."),
  },

  // ---------------------------------------------------------- operations
  {
    id: "operations.error_tracking",
    area: "operations",
    title: "Error tracking",
    why: "Most users who hit an error leave without telling you. Error tracking is how you find out.",
    recommendation: "Add an error tracker to both the frontend and the server, with release tagging so you can tell which deploy introduced an error.",
    effort: "hours",
    verify: "Throw a test error in production and see it arrive in the tracker.",
    question: "How do you find out about production errors?",
    priority: (c) => (userFacing(c) ? "recommended" : "optional"),
    evaluate(s) {
      const deps = depsMatching(s, ["@sentry/", "@highlight-run/", "@bugsnag/", "rollbar", "@rollbar/", "@datadog/browser-rum", "@honeybadger-io/", "@logtail/", "@axiomhq/", "@baselime/", "posthog-node"]);
      const scripts = s.site ? s.site.scripts.filter((x) => /sentry|bugsnag|rollbar|datadog|highlight\.io|logrocket/i.test(x)).slice(0, 2) : [];
      const evidence = [...depEvidence(deps, "Error-tracking dependency"), ...scripts.map((ref) => ({ source: "website" as const, ref, detail: "Error-tracking script on homepage" }))];
      if (evidence.length) return result("detected", "Error tracking is installed.", evidence);
      if (!s.repo && !s.site) return result("needs_confirmation", NO_REPO);
      return result("needs_confirmation", "No error-tracking SDK found. Your host's logs may be enough to start with, but they won't alert you.");
    },
  },
  {
    id: "operations.uptime",
    area: "operations",
    title: "Uptime monitoring",
    why: "You should hear about an outage from an alert, not from a customer.",
    recommendation: "Add an external uptime check on the homepage and a health endpoint, alerting to a channel you actually read.",
    effort: "minutes",
    verify: "With UptimeRobot or Better Stack connected, ProductRoot checks a monitor covers the site and reports it up. Also test that an alert actually reaches you.",
    question: "Is anything alerting you when the site goes down?",
    dependsOn: ["site.reachable"],
    priority: (c) => (live(c) ? "recommended" : "optional"),
    evaluate(s) {
      if (s.uptimeError) return result("needs_confirmation", `Couldn't read your uptime monitors: ${s.uptimeError}`);
      if (!s.uptime) return result("needs_confirmation", "Uptime monitors run outside your code. Connect UptimeRobot or Better Stack to verify this automatically, or confirm it yourself.");
      const host = s.site ? new URL(s.site.finalUrl).hostname.replace(/^www\./, "") : null;
      if (!host) return result("needs_confirmation", `${s.uptime.provider} is connected, but no website was assessed to match monitors against.`);
      const matches = s.uptime.monitors.filter((m) => {
        try {
          return new URL(m.url).hostname.replace(/^www\./, "") === host;
        } catch {
          return false;
        }
      });
      const evidence: Evidence[] = matches.slice(0, 3).map((m) => ({ source: "rule", ref: m.url, detail: `${s.uptime!.provider} monitor, status ${m.status || "unknown"}` }));
      if (matches.some((m) => m.up)) return result("verified", `${s.uptime.provider} monitors ${host} and reports it up.`, evidence);
      if (matches.length) return result("missing", `${s.uptime.provider} monitors ${host} but it isn't reporting up (${matches[0].status}).`, evidence);
      return result("missing", `None of your ${s.uptime.monitors.length} ${s.uptime.provider} monitors covers ${host}.`, [{ source: "rule", ref: s.uptime.provider, detail: `Checked ${s.uptime.monitors.length} monitors` }]);
    },
  },
  {
    id: "operations.email",
    area: "operations",
    title: "Transactional email",
    why: "Receipts, password resets and notifications need a sender with proper domain authentication (SPF, DKIM, DMARC) or they land in spam.",
    recommendation: "Use a transactional email service and authenticate your sending domain.",
    effort: "hours",
    verify: "Send a test email to a Gmail and an Outlook address and check it lands in the inbox.",
    question: "How does the product send email (receipts, resets, notifications)?",
    priority: (c) => (c.productType === "saas" ? "recommended" : c.productType === "api" || c.productType === "mobile" ? "optional" : null),
    evaluate(s) {
      if (!s.repo) return result("needs_confirmation", NO_REPO);
      const deps = depsMatching(s, ["resend", "@sendgrid/mail", "postmark", "nodemailer", "@aws-sdk/client-ses", "@aws-sdk/client-sesv2", "mailgun.js", "@react-email/", "loops", "mailersend", "@getbrevo/brevo", "@mailchimp/mailchimp_transactional", "plunk"]);
      if (deps.length) return result("detected", "Found an email-sending library.", depEvidence(deps, "Email dependency"));
      const managed = matching(AUTH_PROVIDERS, s.repo).filter((p) => MANAGED_AUTH.has(p));
      return result("needs_confirmation", managed.length ? `${managed[0]} sends auth emails, but receipts and notifications still need a sender.` : "No email-sending library found.");
    },
  },

  // -------------------------------------------------------------- growth
  {
    id: "growth.analytics",
    area: "growth",
    title: "Product analytics",
    why: "After launch, the first question is where people drop off. Without analytics there's no answer.",
    recommendation: "Track a handful of events that matter (sign-up, activation, purchase) rather than everything. Consider privacy-friendly tools if you want to avoid cookie banners.",
    effort: "hours",
    verify: "Trigger a sign-up on production and see the event in the analytics dashboard.",
    question: "Which analytics tool do you use, and which events do you track?",
    priority: (c) => (c.productType === "saas" || c.productType === "content" || c.productType === "mobile" ? "recommended" : "optional"),
    evaluate(s) {
      const deps = depsMatching(s, ["@vercel/analytics", "posthog-js", "posthog-node", "plausible-tracker", "next-plausible", "mixpanel-browser", "@amplitude/", "@segment/", "react-ga4", "@next/third-parties", "@umami/", "fathom-client", "@rudderstack/"]);
      const scripts = s.site ? s.site.scripts.filter((x) => /googletagmanager|google-analytics|plausible|posthog|umami|usefathom|cloudflareinsights|simpleanalytics|_vercel\/insights|matomo|mixpanel|amplitude|segment\.com|clarity\.ms/i.test(x)).slice(0, 3) : [];
      const evidence = [...depEvidence(deps, "Analytics dependency"), ...scripts.map((ref) => ({ source: "website" as const, ref, detail: "Analytics script on homepage" }))];
      if (evidence.length) return result("detected", "Analytics is installed.", evidence);
      if (!s.repo && !s.site) return result("needs_confirmation", NO_SITE);
      return result("needs_confirmation", "No analytics SDK or script found. Server-side or proxy-based analytics would not show up here.");
    },
  },
  {
    id: "growth.discoverability",
    area: "growth",
    title: "Search and AI-search discoverability",
    why: "Indexability, metadata, structured data and crawler access decide whether people (and AI assistants) can find and cite your product.",
    recommendation: "Work through MetaInfo's fix plan, starting with blockers and critical issues.",
    effort: "hours",
    verify: "MetaInfo re-scans the production URL: score of at least 70 with no critical failures.",
    question: "Has the production site been checked for SEO and AI-search readiness?",
    dependsOn: ["site.reachable"],
    tools: ["metainfo"],
    priority: (c) => (c.productType === "saas" || c.productType === "content" || c.productType === "oss" ? "recommended" : "optional"),
    evaluate(s) {
      const m = s.metainfo;
      if (!m) return result("needs_confirmation", s.metainfoError ?? NO_SITE);
      const critical = m.failing.filter((f) => f.status === "fail" && f.severity === "critical");
      const top = [...critical, ...m.failing.filter((f) => !critical.includes(f))].slice(0, 5);
      const evidence: Evidence[] = [
        { source: "metainfo", ref: m.reportUrl, detail: `Overall ${m.overall}/100 (${Object.entries(m.scores).map(([k, v]) => `${k} ${v}`).join(", ")})` },
        ...top.map((f) => ({ source: "metainfo" as const, ref: f.id, detail: `${f.status === "fail" ? "Fail" : "Warn"} (${f.severity}): ${f.title}` })),
      ];
      if (m.overall >= 70 && critical.length === 0) return result("verified", `MetaInfo score ${m.overall}/100 with no critical failures.`, evidence);
      return result("missing", `MetaInfo score ${m.overall}/100 with ${critical.length} critical failure${critical.length === 1 ? "" : "s"}.`, evidence);
    },
  },
  {
    id: "growth.launch_announcement",
    area: "growth",
    title: "Launch announcement plan",
    why: "A launch without distribution is a deploy. Decide where you'll announce (communities, social, directories, your list) before launch day.",
    recommendation: "Draft posts for two or three channels where your users already are. SocialBrewery can draft and publish them to LinkedIn, X, Reddit, Hashnode and more, but only after you approve each post.",
    effort: "hours",
    verify: "Announcement drafts exist for each chosen channel and are scheduled or published.",
    question: "Where will you announce the launch, and are the posts drafted?",
    tools: ["socialbrewery"],
    priority: (c) => (preLaunch(c) ? "recommended" : "optional"),
    evaluate: () => result("needs_confirmation", "Launch planning is yours to confirm. Connect SocialBrewery to draft and publish posts."),
  },

  // ------------------------------------------------------------- support
  {
    id: "support.channel",
    area: "support",
    title: "Support and contact channel",
    why: "Early users who can reach you become your best source of feedback; ones who can't, churn silently.",
    recommendation: "Put a contact email, support page or community link in the footer and in the app.",
    effort: "minutes",
    verify: "Send yourself a message through the published channel and get it.",
    question: "How can users reach you?",
    priority: (c) => (c.productType === "other" || c.productType === "content" ? "optional" : "recommended"),
    evaluate(s) {
      const links = linksMatching(s, /(^mailto:|contact|support|help|feedback|discord\.(gg|com\/invite)|community)/i);
      const files = filesMatching(s, /(^|\/)SUPPORT\.md$/i, 1);
      const evidence = [...linkEvidence(links, "Homepage link"), ...fileEvidence(files, "Support file")];
      if (evidence.length) return result("detected", "Found a way to get in touch.", evidence);
      if (siteOk(s)) return result("missing", "No contact, support or community link on the homepage.", [{ source: "website", ref: s.site!.finalUrl, detail: `Checked ${s.site!.links.length} homepage links` }]);
      return result("needs_confirmation", NO_SITE);
    },
  },

  // --------------------------------------------------------- open source
  {
    id: "oss.readme",
    area: "opensource",
    title: "README with install and usage",
    why: "The README is the landing page for a repository. Without install and usage instructions, visitors leave.",
    recommendation: "Cover what it is, a screenshot or example, install, quick start, and where to get help.",
    effort: "hours",
    verify: "Someone new follows the README from a clean machine without asking you anything.",
    question: "Does the README explain installation and usage?",
    priority: (c) => (c.productType === "oss" ? "blocker" : c.productType === "api" ? "recommended" : c.hasRepo ? "optional" : null),
    evaluate: (s) => presence(s, /^README(\.[a-z]+)?$/i, "Found a README.", "No README at the repository root."),
  },
  {
    id: "oss.license",
    area: "opensource",
    title: "Open-source license",
    why: "Without a license, nobody can legally use, modify or redistribute your code, whatever the repository's visibility.",
    recommendation: "Pick a license that matches your intent (permissive like MIT/Apache-2.0, or copyleft like GPL) and add a LICENSE file.",
    effort: "minutes",
    verify: "GitHub shows the license in the repository sidebar.",
    question: "Which license is the project released under?",
    priority: (c) => (c.productType === "oss" ? "blocker" : null),
    evaluate(s) {
      if (s.repo?.license) return result("detected", `Licensed under ${s.repo.license}.`, [{ source: "github", ref: `${s.repo.owner}/${s.repo.repo}`, detail: `GitHub license: ${s.repo.license}` }]);
      return presence(s, /^(LICEN[CS]E|COPYING)(\.[a-z]+)?$/i, "Found a license file.", "No LICENSE file at the repository root.");
    },
  },
  {
    id: "oss.contributing",
    area: "opensource",
    title: "Contributing guide",
    why: "A contributing guide turns drive-by interest into pull requests you can actually merge.",
    recommendation: "Explain how to set up the dev environment, run tests, and what makes a good pull request.",
    effort: "hours",
    verify: "A first-time contributor's PR follows the guide.",
    question: "Is there a contributing guide?",
    priority: (c) => (c.productType === "oss" ? "recommended" : null),
    evaluate: (s) => presence(s, /^(\.github\/|docs\/)?CONTRIBUTING(\.[a-z]+)?$/i, "Found a contributing guide.", "No CONTRIBUTING file found."),
  },
  {
    id: "oss.security_policy",
    area: "opensource",
    title: "Security policy",
    why: "Tells researchers how to report vulnerabilities privately instead of in a public issue.",
    recommendation: "Add SECURITY.md with a private contact or enable GitHub private vulnerability reporting.",
    effort: "minutes",
    verify: "GitHub shows a security policy on the repository's Security tab.",
    question: "How should people report security issues?",
    priority: (c) => (c.productType === "oss" ? "recommended" : null),
    evaluate: (s) => presence(s, /^(\.github\/|docs\/)?SECURITY(\.[a-z]+)?$/i, "Found a security policy.", "No SECURITY file found."),
  },
  {
    id: "oss.issue_templates",
    area: "opensource",
    title: "Issue templates",
    why: "Templates get you reproducible bug reports instead of 'it doesn't work'.",
    recommendation: "Add bug report and feature request templates under .github/ISSUE_TEMPLATE.",
    effort: "minutes",
    verify: "Opening a new issue offers the templates.",
    question: "Are there issue templates?",
    priority: (c) => (c.productType === "oss" ? "recommended" : null),
    evaluate: (s) => presence(s, /^\.github\/(ISSUE_TEMPLATE\/|ISSUE_TEMPLATE\.md$)/i, "Found issue templates.", "No issue templates found."),
  },
  {
    id: "oss.releases",
    area: "opensource",
    title: "Release process and changelog",
    why: "Users need to know what changed between versions and when it's safe to upgrade.",
    recommendation: "Keep a CHANGELOG or use a release tool (Changesets, release-please, semantic-release) from CI.",
    effort: "hours",
    verify: "The latest release has notes describing its changes.",
    question: "How do you cut releases and communicate changes?",
    priority: (c) => (c.productType === "oss" ? "recommended" : null),
    evaluate: (s) =>
      presence(s, /(^CHANGELOG(\.[a-z]+)?$|^\.changeset\/|release-please|^\.releaserc|^\.goreleaser|^\.github\/workflows\/[^/]*release[^/]*\.ya?ml$)/i, "Found a changelog or release automation.", "No changelog or release automation found."),
  },
];

export const CHECK_BY_ID: Record<string, CheckDef> = Object.fromEntries(CHECKS.map((c) => [c.id, c]));

/** Run every check against the collected signals. */
export function evaluateAll(signals: Signals): CheckResult[] {
  return CHECKS.map((c) => ({ id: c.id, ...c.evaluate(signals) }));
}
