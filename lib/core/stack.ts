// Stack detection from repository signals. Deterministic: dependency names and
// well-known file paths only.

import type { RepoSignals } from "./signals";
import type { StackSummary } from "./types";

type Rule = [label: string, match: (r: RepoSignals) => boolean];

const dep = (...names: string[]) => (r: RepoSignals) => names.some((n) => (n.endsWith("/") ? Object.keys(r.deps).some((d) => d.startsWith(n)) : n in r.deps));
const file = (...patterns: RegExp[]) => (r: RepoSignals) => r.files.some((f) => patterns.some((p) => p.test(f)));
const either = (...fns: ((r: RepoSignals) => boolean)[]) => (r: RepoSignals) => fns.some((f) => f(r));

const FRAMEWORKS: Rule[] = [
  ["Next.js", dep("next")],
  ["Remix", dep("@remix-run/react", "@remix-run/node")],
  ["React Router", dep("@react-router/dev")],
  ["SvelteKit", dep("@sveltejs/kit")],
  ["Nuxt", dep("nuxt")],
  ["Astro", dep("astro")],
  ["Angular", dep("@angular/core")],
  ["SolidStart", dep("@solidjs/start")],
  ["Gatsby", dep("gatsby")],
  ["NestJS", dep("@nestjs/core")],
  ["Express", dep("express")],
  ["Fastify", dep("fastify")],
  ["Hono", dep("hono")],
  ["Expo", dep("expo")],
  ["React Native", dep("react-native")],
  ["Vite", dep("vite")],
];

/** Files whose presence means dependency facts come from another ecosystem. */
const NON_JS: Rule[] = [
  ["Python", file(/(^|\/)(requirements\.txt|pyproject\.toml|Pipfile)$/)],
  ["Go", file(/(^|\/)go\.mod$/)],
  ["Rust", file(/(^|\/)Cargo\.toml$/)],
  ["Ruby", file(/(^|\/)Gemfile$/)],
  ["PHP", file(/(^|\/)composer\.json$/)],
  ["Java/Kotlin", file(/(^|\/)(pom\.xml|build\.gradle(\.kts)?)$/)],
  ["Elixir", file(/(^|\/)mix\.exs$/)],
  ["Swift", file(/(^|\/)Package\.swift$/, /\.xcodeproj\//)],
  ["Dart", file(/(^|\/)pubspec\.yaml$/)],
];

export const HOSTING: Rule[] = [
  ["Cloudflare", file(/(^|\/)wrangler\.(toml|jsonc?)$/)],
  ["Vercel", either(file(/(^|\/)vercel\.json$/), dep("@vercel/analytics", "@vercel/functions"))],
  ["Netlify", file(/(^|\/)netlify\.toml$/)],
  ["Fly.io", file(/(^|\/)fly\.toml$/)],
  ["Render", file(/(^|\/)render\.yaml$/)],
  ["Railway", file(/(^|\/)railway\.(json|toml)$/)],
  ["Firebase", file(/(^|\/)firebase\.json$/)],
  ["AWS", either(file(/(^|\/)(serverless\.ya?ml|amplify\.ya?ml|template\.ya?ml|cdk\.json|samconfig\.toml)$/), dep("sst"))],
  ["Google App Engine", file(/(^|\/)app\.ya?ml$/)],
  ["Heroku", file(/(^|\/)Procfile$/)],
  ["Docker", file(/(^|\/)(Dockerfile|docker-compose\.ya?ml|compose\.ya?ml)$/)],
];

const DATABASES: Rule[] = [
  ["Prisma", dep("prisma", "@prisma/client")],
  ["Drizzle", dep("drizzle-orm")],
  ["Kysely", dep("kysely")],
  ["TypeORM", dep("typeorm")],
  ["Sequelize", dep("sequelize")],
  ["Mongoose / MongoDB", dep("mongoose", "mongodb")],
  ["Supabase", dep("@supabase/supabase-js", "@supabase/ssr")],
  ["Firebase", dep("firebase", "firebase-admin")],
  ["PostgreSQL", dep("pg", "postgres", "@neondatabase/serverless", "@vercel/postgres")],
  ["MySQL", dep("mysql2", "@planetscale/database")],
  ["SQLite / libSQL", dep("better-sqlite3", "@libsql/client")],
  ["Cloudflare D1", file(/(^|\/)wrangler\.(toml|jsonc?)$/)],
  ["Redis", dep("redis", "ioredis", "@upstash/redis")],
  ["Convex", dep("convex")],
];

export const AUTH_PROVIDERS: Rule[] = [
  ["Clerk", dep("@clerk/")],
  ["Auth.js / NextAuth", dep("next-auth", "@auth/core")],
  ["Better Auth", dep("better-auth")],
  ["Lucia", dep("lucia")],
  ["Supabase Auth", dep("@supabase/auth-helpers-nextjs", "@supabase/ssr", "@supabase/auth-js")],
  ["Firebase Auth", dep("firebase", "firebase-admin")],
  ["Auth0", dep("@auth0/")],
  ["Kinde", dep("@kinde-oss/")],
  ["WorkOS", dep("@workos-inc/")],
  ["Stack Auth", dep("@stackframe/")],
  ["Passport", dep("passport")],
  ["Ory", dep("@ory/")],
  ["Convex Auth", dep("@convex-dev/auth")],
];

/** Hosted auth providers that ship verification, reset and recovery flows themselves. */
export const MANAGED_AUTH = new Set(["Clerk", "Supabase Auth", "Firebase Auth", "Auth0", "Kinde", "WorkOS", "Stack Auth", "Ory"]);

export const BILLING_PROVIDERS: Rule[] = [
  ["Stripe", dep("stripe", "@stripe/stripe-js", "@stripe/react-stripe-js")],
  ["Paddle", dep("@paddle/")],
  ["Lemon Squeezy", dep("@lemonsqueezy/")],
  ["Polar", dep("@polar-sh/")],
  ["Chargebee", dep("chargebee", "chargebee-typescript")],
  ["Razorpay", dep("razorpay")],
  ["Braintree", dep("braintree")],
  ["RevenueCat", dep("react-native-purchases", "@revenuecat/purchases-js")],
  ["Dodo Payments", dep("dodopayments")],
];

const PACKAGE_MANAGERS: Rule[] = [
  ["pnpm", file(/^pnpm-lock\.yaml$/)],
  ["yarn", file(/^yarn\.lock$/)],
  ["bun", file(/^bun\.lockb?$/)],
  ["npm", file(/^package-lock\.json$/)],
];

export const matching = (rules: Rule[], r: RepoSignals) => rules.filter(([, m]) => m(r)).map(([label]) => label);

export function detectStack(r: RepoSignals): StackSummary {
  const nonJsLangs = matching(NON_JS, r);
  const hasJs = r.manifests.length > 0;
  const languages = [
    ...(hasJs ? [dep("typescript")(r) || file(/(^|\/)tsconfig\.json$/)(r) ? "TypeScript" : "JavaScript"] : []),
    ...nonJsLangs,
  ];
  return {
    languages,
    frameworks: matching(FRAMEWORKS, r),
    packageManager: matching(PACKAGE_MANAGERS, r)[0] ?? null,
    hosting: matching(HOSTING, r),
    databases: matching(DATABASES, r),
    auth: matching(AUTH_PROVIDERS, r),
    billing: matching(BILLING_PROVIDERS, r),
    scripts: Object.keys(r.scripts ?? {}).slice(0, 50),
    nonJs: !hasJs,
  };
}
