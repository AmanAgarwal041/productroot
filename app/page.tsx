import Link from "next/link";
import LaunchMap from "@/components/LaunchMap";
import { samplePlan } from "@/lib/core/sample";

const FEATURES = [
  {
    title: "Know what's missing",
    body: "Identify the pieces your product still needs, from authentication and payments to deployment, security, onboarding and customer support.",
  },
  {
    title: "Find the right tools",
    body: "Recommendations account for your stack, stage, country and business model, instead of a generic tutorial's defaults.",
  },
  {
    title: "Launch with confidence",
    body: "A prioritised plan separates launch blockers from nice-to-haves, so you know what to do today and what can wait.",
  },
];

const STATES: [string, string, string][] = [
  ["verified", "Verified", "A live check or connected service proved it works."],
  ["detected", "Detected", "Evidence in your repo or site, not yet proven."],
  ["confirmed", "Confirmed", "You told us it's done."],
  ["needs_confirmation", "Needs confirmation", "We couldn't tell, so we ask instead of guessing."],
  ["missing", "Missing", "An explicit check found it absent."],
];

export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <div className="eyebrow">Launch readiness for developers</div>
        <h1>You built the product. Now let&apos;s get it launched.</h1>
        <p>
          Connect your repository and website, discover what&apos;s missing, and follow a personalised plan to get launch-ready. No endless research, scattered
          checklists, or integrations you don&apos;t need.
        </p>
        <div className="row">
          <Link className="btn btn-primary btn-lg" href="/projects/new">
            Check my product readiness
          </Link>
          <a className="btn btn-lg btn-ghost" href="#how">
            How it works
          </a>
        </div>
      </section>

      <section className="demo">
        <div className="demo-caption">
          <strong>A sample launch map</strong>
          <span className="small muted">A beta SaaS on subscriptions: three launch blockers left before the gate opens.</span>
        </div>
        <LaunchMap items={samplePlan()} height={480} interactive={false} />
      </section>

      <div className="features">
        {FEATURES.map((f) => (
          <div key={f.title} className="card feature">
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        ))}
      </div>

      <section className="section" id="how">
        <h2>Built around your product, not a generic checklist</h2>
        <p>
          A solo developer launching a free open-source tool doesn&apos;t need the same setup as a paid SaaS. Tell ProductRoot what you&apos;re building and how it
          makes money. It reads your repository and production site (read-only), then marks each item as a launch blocker, recommended, optional, or not needed.
        </p>
      </section>

      <section className="section">
        <h2>Evidence, not checkmarks</h2>
        <p>Every finding shows where it came from. We never mark something verified just because a file exists or you ticked a box.</p>
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

      <section className="section">
        <h2>Your tools should work together</h2>
        <p>
          Keep the tools you already use. ProductRoot reuses MetaInfo for SEO and AI-search readiness and SocialBrewery for launch posts. Anything that publishes,
          charges or changes production waits for your explicit approval.
        </p>
      </section>

      <section className="section">
        <h2>Stop wondering what to do next</h2>
        <p>You&apos;ve already done the hard part. Let&apos;s make the journey from code to customers easier.</p>
        <div className="row" style={{ marginTop: 20 }}>
          <Link className="btn btn-primary btn-lg" href="/projects/new">
            Get your personalised launch plan
          </Link>
        </div>
      </section>
    </main>
  );
}
