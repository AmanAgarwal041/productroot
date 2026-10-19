import Link from "next/link";
import LaunchMap from "@/components/LaunchMap";
import Logo from "@/components/Logo";
import Screenshot from "@/components/Screenshot";
import { CHECKS } from "@/lib/core/checks";
import { CATALOG } from "@/lib/core/catalog-data";
import { samplePlan } from "@/lib/core/sample";

const STEPS = [
  { n: "1", title: "Connect", body: "Add your GitHub repository and production URL. Read-only: file paths, package.json and your homepage. Nothing else." },
  { n: "2", title: "Assess", body: `${CHECKS.length} deterministic checks across auth, payments, legal, security, infrastructure, operations and growth, each with the evidence behind it.` },
  { n: "3", title: "Plan", body: "Launch blockers, recommended and optional items, prioritised for your product type, stage and business model. Not a generic checklist." },
  { n: "4", title: "Act and verify", body: "Compare providers, open pull requests and publish launch posts, each only after your approval. Re-checks catch regressions." },
];

const SHOWCASE = [
  {
    eyebrow: "Plan",
    title: "Know exactly what's left, and why",
    body: "Every item explains why it matters, what to do, how to verify it, and what evidence we found. Skip what doesn't apply, confirm what you've done, and watch a newer scan reopen anything that regresses.",
    points: ["Blockers, recommended and optional, per your context", "Evidence from GitHub, your site and MetaInfo", "Done, skipped and not-applicable decisions survive re-scans"],
    shot: { name: "plan", height: 1222, alt: "ProductRoot plan view grouping launch blockers, recommended and optional tasks with evidence" },
  },
  {
    eyebrow: "Providers",
    title: "Find the tools that fit, not the ones with the best ads",
    body: `A sourced catalog of ${CATALOG.length} providers for payments, auth, hosting, error tracking, uptime, email and analytics. Payment eligibility is filtered by where you sell from and how you're set up, and never guessed.`,
    points: ["Seller country and business-type eligibility", "Merchant-of-record vs processor, explained", "Every fact linked to the official source, with a verified date"],
    shot: { name: "providers", height: 1389, alt: "Payment provider comparison filtered for an individual seller in India" },
  },
  {
    eyebrow: "Workflows",
    title: "Automation with a human in the loop",
    body: "Generate the files a check needs (a CI workflow, LICENSE, SECURITY.md, contributing guide, issue templates, changelog) and preview them before anything happens. Approved runs open a pull request on a new branch. They never touch your default branch or overwrite a file.",
    points: ["Preview every file before proposing", "Admins approve; every step is audited", "Idempotent pull requests; social posts never auto-retried"],
    shot: { name: "workflows", height: 1311, alt: "Pull request composer previewing a generated GitHub Actions CI workflow" },
  },
  {
    eyebrow: "Integrations",
    title: "Honest about what's automated",
    body: "Each integration shows what it can really do: connect, discover, read, execute, verify. Credentials are checked with the provider, encrypted per workspace, and can be removed any time.",
    points: ["GitHub fine-grained tokens for private repos and PRs", "SocialBrewery for launch posts, UptimeRobot or Better Stack to verify uptime", "AES-256-GCM encryption bound to your workspace"],
    shot: { name: "integrations", height: 1277, alt: "Integrations page listing GitHub, MetaInfo, SocialBrewery and uptime monitors with capability matrices" },
  },
];

const FEATURES = [
  ["Launch map", "Your whole path to launch as a diagram, from foundations through a launch-ready gate to operations."],
  ["Evidence states", "Verified, detected, confirmed, needs confirmation, missing. Never a checkmark without a reason."],
  ["Context-aware priorities", "A free open-source tool and a paid SaaS get different plans. Change your stage and the plan updates instantly."],
  ["Sourced provider catalog", "Fees, free tiers, merchant-of-record status and eligibility, each linked to the provider's own page."],
  ["Approval-gated actions", "Pull requests and launch posts run only after an admin approves, exactly once, with an audit trail."],
  ["Scheduled re-checks", "Re-assessed automatically; you're notified when something that worked stops working."],
  ["Uptime verification", "Connect UptimeRobot or Better Stack and we check a monitor really covers your site and reports it up."],
  ["Teams", "Personal and organisation workspaces with roles, on the same sign-in as MetaInfo and SocialBrewery."],
  ["Private by design", "Read-only by default. We store derived evidence, never your source code or page HTML."],
] as const;

const STATES: [string, string, string][] = [
  ["verified", "Verified", "A live check or connected service proved it works."],
  ["detected", "Detected", "Evidence in your repo or site, not yet proven."],
  ["confirmed", "Confirmed", "You told us it's done."],
  ["needs_confirmation", "Needs confirmation", "We couldn't tell, so we ask instead of guessing."],
  ["missing", "Missing", "An explicit check found it absent."],
];

const FAMILY = [
  {
    name: "MetaInfo",
    url: "https://metainfo.agarwal-aman041.workers.dev",
    img: "/landing/family-metainfo.jpg",
    body: "See any page the way Google, Bing, ChatGPT, Perplexity, Claude and Gemini do. 55+ checks, a prioritised fix plan, schema validation and keyword research. ProductRoot uses it for discoverability checks.",
  },
  {
    name: "SocialBrewery",
    url: "https://socialbrewery.agarwal-aman041.workers.dev",
    img: "/landing/family-socialbrewery.jpg",
    body: "Tell Grok what to make and it writes, generates and posts to YouTube Shorts, LinkedIn, Instagram, X, Hashnode, Slack and Reddit. ProductRoot uses it to publish your launch announcement, after you approve.",
  },
];

export default function Home() {
  return (
    <main className="landing">
      <section className="page lp-hero">
        <div className="eyebrow">Launch readiness for developers</div>
        <h1>You built the product. Now let&apos;s get it launched.</h1>
        <p>
          ProductRoot reads your repository and production site, finds what&apos;s missing before launch, recommends tools that fit your stack and country, and does the
          repeatable work with your approval. No endless research, scattered checklists, or integrations you don&apos;t need.
        </p>
        <div className="row">
          <Link className="btn btn-primary btn-lg" href="/projects/new">
            Check my product readiness
          </Link>
          <a className="btn btn-lg" href="https://github.com/AmanAgarwal041/productroot" target="_blank" rel="noreferrer">
            View on GitHub
          </a>
        </div>
        <p className="small muted lp-hero-note">Free while in beta · read-only by default · nothing changes without your approval</p>
      </section>

      <section className="page lp-hero-shot">
        <Screenshot name="overview" height={1500} priority alt="ProductRoot overview: readiness score, launch map from foundations to a launch-ready gate, next steps and evidence sources" />
      </section>

      <section className="page lp-section">
        <h2 className="lp-h2">How it works</h2>
        <ol className="lp-steps">
          {STEPS.map((s) => (
            <li key={s.n} className="card">
              <span className="lp-step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {SHOWCASE.map((s, i) => (
        <section key={s.eyebrow} className={`page lp-row${i % 2 ? " is-flipped" : ""}`}>
          <div className="lp-row-copy">
            <div className="eyebrow">{s.eyebrow}</div>
            <h2>{s.title}</h2>
            <p>{s.body}</p>
            <ul className="lp-points">
              {s.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="lp-row-shot">
            <Screenshot name={s.shot.name} height={s.shot.height} alt={s.shot.alt} />
          </div>
        </section>
      ))}

      <section className="page lp-section">
        <div className="demo-caption">
          <div>
            <h2 className="lp-h2">Try the launch map</h2>
            <p className="muted">A sample beta SaaS on subscriptions: three launch blockers left before the gate opens. Drag to pan, scroll to zoom.</p>
          </div>
        </div>
        <LaunchMap items={samplePlan()} height={520} interactive />
      </section>

      <section className="page lp-section">
        <h2 className="lp-h2">Evidence, not checkmarks</h2>
        <p className="muted lp-lead">Every finding shows where it came from. We never mark something verified just because a file exists or you ticked a box.</p>
        <div className="legend">
          {STATES.map(([k, label, desc]) => (
            <div key={k} className="card" style={{ padding: "12px 14px", flex: "1 1 180px" }}>
              <span className={`badge b-${k}`}>{label}</span>
              <p className="small muted" style={{ marginTop: 6 }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="page lp-section">
        <h2 className="lp-h2">Everything in the box</h2>
        <div className="lp-features">
          {FEATURES.map(([t, b]) => (
            <div key={t} className="lp-feature">
              <h3>{t}</h3>
              <p>{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="page lp-section">
        <h2 className="lp-h2">Part of a product family</h2>
        <p className="muted lp-lead">ProductRoot orchestrates; it doesn&apos;t rebuild. It reuses its siblings through their real APIs, and you sign in once for all three.</p>
        <div className="lp-family">
          {FAMILY.map((f) => (
            <a key={f.name} className="lp-family-card" href={f.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- static asset */}
              <img src={f.img} alt={`${f.name} screenshot`} width={1600} height={1000} loading="lazy" decoding="async" />
              <div>
                <h3>{f.name} ↗</h3>
                <p>{f.body}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="page lp-cta">
        <h2>Stop wondering what to do next</h2>
        <p>You&apos;ve already done the hard part. Get a launch plan grounded in your own product in about a minute.</p>
        <Link className="btn btn-primary btn-lg" href="/projects/new">
          Get your launch plan
        </Link>
      </section>

      <footer className="page lp-footer">
        <div className="row">
          <Logo size={18} />
          <strong>ProductRoot</strong>
          <span className="muted small">General guidance, not legal, tax or financial advice.</span>
        </div>
        <div className="row small">
          <a href="https://github.com/AmanAgarwal041/productroot" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href="https://metainfo.agarwal-aman041.workers.dev" target="_blank" rel="noreferrer">
            MetaInfo
          </a>
          <a href="https://socialbrewery.agarwal-aman041.workers.dev" target="_blank" rel="noreferrer">
            SocialBrewery
          </a>
        </div>
      </footer>
    </main>
  );
}
