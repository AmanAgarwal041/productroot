// Provider catalog data. Every changeable fact (fees, free tiers, seller
// countries, business types, merchant-of-record status) was checked against
// the official pages listed in each entry's `sources` on 2026-10-15.
// Unconfirmed facts are null, never guessed. Re-verify at least every
// 90 days (STALE_DAYS in catalog.ts); the UI flags stale entries.
//
// To update: re-check the sources, edit the entry, and bump its verifiedAt.

import type { ProviderOption } from "./catalog";

export const CATALOG_VERIFIED_AT = "2026-10-15";

export const CATALOG: ProviderOption[] = [
  {
    "id": "stripe",
    "name": "Stripe",
    "capability": "payments",
    "summary": "Payment processing platform with APIs for one-time and recurring payments; the seller is the merchant of record unless Stripe Managed Payments is used.",
    "website": "https://stripe.com",
    "pricingModel": "Per-transaction fee, no monthly fee on standard pricing",
    "freeTier": "No monthly or setup fees; pay per successful transaction",
    "fees": "2.9% + 30¢ per successful transaction for domestic cards (US); +1.5% for international cards; +1% if currency conversion is required; +0.5% for manually entered cards",
    "merchantOfRecord": false,
    "sellerCountries": [
      "AU",
      "AT",
      "BE",
      "BR",
      "BG",
      "CA",
      "HR",
      "CY",
      "CZ",
      "DK",
      "EE",
      "FI",
      "FR",
      "DE",
      "GI",
      "GR",
      "HK",
      "HU",
      "IE",
      "IT",
      "JP",
      "LV",
      "LI",
      "LT",
      "LU",
      "MY",
      "MT",
      "MX",
      "NL",
      "NZ",
      "NO",
      "PL",
      "PT",
      "RO",
      "SG",
      "SK",
      "SI",
      "ES",
      "SE",
      "CH",
      "TH",
      "AE",
      "GB",
      "US"
    ],
    "businessTypes": [
      "individual",
      "sole_proprietor",
      "company"
    ],
    "frameworks": [],
    "setup": "hours",
    "prerequisites": [
      "Business or individual based in a Stripe-supported country",
      "Bank account in that country",
      "Identity/business verification (KYC)",
      "Website describing products and pricing"
    ],
    "limitations": [
      "Seller is merchant of record: you are responsible for sales tax/VAT registration and remittance (Stripe Tax is a paid add-on)",
      "India and Indonesia listed as 'Preview' on the global availability page; Côte d'Ivoire, Ghana, Kenya, Nigeria, South Africa served via Paystack, not Stripe accounts",
      "Fees differ by country (e.g. India pricing is 2% domestic / 3% international cards)",
      "Stripe Managed Payments (Stripe as MoR, eligibility-reviewed) is limited to digital products, Checkout/Payment Links only, sellers in 37 listed countries"
    ],
    "sources": [
      {
        "label": "Pricing (US)",
        "url": "https://stripe.com/us/pricing"
      },
      {
        "label": "Global availability",
        "url": "https://stripe.com/global"
      },
      {
        "label": "Account business_type (API)",
        "url": "https://docs.stripe.com/api/accounts/create"
      },
      {
        "label": "Managed Payments",
        "url": "https://docs.stripe.com/payments/managed-payments"
      },
      {
        "label": "Managed Payments eligibility",
        "url": "https://docs.stripe.com/payments/managed-payments/eligibility"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided",
    "detectAs": [
      "Stripe"
    ]
  },
  {
    "id": "paddle",
    "name": "Paddle",
    "capability": "payments",
    "summary": "Merchant of record for software and SaaS businesses that handles checkout, subscription billing and global sales tax.",
    "website": "https://www.paddle.com",
    "pricingModel": "Per-transaction fee (all-inclusive MoR)",
    "freeTier": "No monthly fees; pay per transaction",
    "fees": "5% + 50¢ per Checkout transaction",
    "merchantOfRecord": true,
    "sellerCountries": "global",
    "businessTypes": [
      "individual",
      "sole_proprietor",
      "company"
    ],
    "frameworks": [],
    "setup": "days",
    "prerequisites": [
      "Software/digital product eligible under Paddle's acceptable use policy",
      "Live website/domain for domain review",
      "Identity verification (business verification additionally for companies)"
    ],
    "limitations": [
      "Account verification (domain review, identity, business) required before going live",
      "Software only: physical goods, pure human services and other non-software offerings not allowed",
      "Sellers in ~28 sanctioned/unsupported countries and regions cannot use Paddle",
      "Higher per-transaction fee than a plain processor in exchange for MoR"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://www.paddle.com/pricing"
      },
      {
        "label": "Supported seller countries",
        "url": "https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle"
      },
      {
        "label": "Account verification (individuals/sole traders)",
        "url": "https://www.paddle.com/help/start/account-verification/what-is-account-verification"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided",
    "detectAs": [
      "Paddle"
    ]
  },
  {
    "id": "lemon-squeezy",
    "name": "Lemon Squeezy",
    "capability": "payments",
    "summary": "Merchant of record for digital products and SaaS, owned by Stripe and transitioning toward Stripe Managed Payments.",
    "website": "https://www.lemonsqueezy.com",
    "pricingModel": "Per-transaction fee (MoR)",
    "freeTier": "No monthly platform fees",
    "fees": "5% + 50¢ per transaction",
    "merchantOfRecord": true,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [],
    "setup": "hours",
    "prerequisites": [
      "Digital product or SaaS",
      "PayPal or bank payout account in a supported payout country",
      "Store activation/identity review"
    ],
    "limitations": [
      "Acquired by Stripe (2024); Jan 2026 update says the product is evolving into Stripe Managed Payments and Lemon Squeezy users will be moved over — risky for new integrations",
      "Company acknowledged slower support and fewer product updates during the transition",
      "Bank payouts in ~130+ countries, PayPal in 200+; India bank payouts invite-only",
      "Seller business types not stated in docs"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://www.lemonsqueezy.com/pricing"
      },
      {
        "label": "2026 update (Stripe Managed Payments)",
        "url": "https://www.lemonsqueezy.com/blog/2026-update"
      },
      {
        "label": "Supported countries",
        "url": "https://docs.lemonsqueezy.com/help/getting-started/supported-countries"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided",
    "detectAs": [
      "Lemon Squeezy"
    ]
  },
  {
    "id": "polar",
    "name": "Polar",
    "capability": "payments",
    "summary": "Open-source merchant of record for developers selling SaaS, digital products and usage-based billing.",
    "website": "https://polar.sh",
    "pricingModel": "Per-transaction fee on free Starter plan; lower rates on paid plans",
    "freeTier": "Starter plan: no monthly fee",
    "fees": "5% + 50¢ per transaction (Starter); +1.5% for international (non-US) cards; +0.5% subscription fee for Early Member plans; $15 per dispute",
    "merchantOfRecord": true,
    "sellerCountries": [
      "AL",
      "DZ",
      "AO",
      "AG",
      "AR",
      "AM",
      "AU",
      "AT",
      "AZ",
      "BS",
      "BH",
      "BD",
      "BE",
      "BJ",
      "BT",
      "BO",
      "BA",
      "BW",
      "BN",
      "BG",
      "KH",
      "CA",
      "CL",
      "CO",
      "CR",
      "HR",
      "CY",
      "CZ",
      "DK",
      "DO",
      "EC",
      "EG",
      "SV",
      "EE",
      "ET",
      "FI",
      "FR",
      "GA",
      "GM",
      "DE",
      "GH",
      "GR",
      "GT",
      "GY",
      "HK",
      "HU",
      "IS",
      "IN",
      "ID",
      "IE",
      "IL",
      "IT",
      "CI",
      "JM",
      "JP",
      "JO",
      "KZ",
      "KE",
      "KW",
      "LA",
      "LV",
      "LI",
      "LT",
      "LU",
      "MO",
      "MG",
      "MY",
      "MT",
      "MU",
      "MX",
      "MD",
      "MC",
      "MN",
      "MA",
      "MZ",
      "NA",
      "NL",
      "NZ",
      "NE",
      "NG",
      "MK",
      "NO",
      "OM",
      "PK",
      "PA",
      "PY",
      "PE",
      "PH",
      "PL",
      "PT",
      "QA",
      "RO",
      "RW",
      "LC",
      "SM",
      "SA",
      "SN",
      "RS",
      "SG",
      "SK",
      "SI",
      "ZA",
      "KR",
      "ES",
      "LK",
      "SE",
      "CH",
      "TW",
      "TZ",
      "TH",
      "TT",
      "TN",
      "TR",
      "AE",
      "GB",
      "US",
      "UY",
      "UZ",
      "VN"
    ],
    "businessTypes": [
      "individual",
      "company"
    ],
    "frameworks": [
      "Next.js",
      "Remix",
      "SvelteKit",
      "Nuxt",
      "Astro",
      "Express",
      "Hono",
      "Fastify",
      "Elysia",
      "TanStack Start",
      "Laravel"
    ],
    "setup": "hours",
    "prerequisites": [
      "Payout account via Stripe Connect Express in a supported country",
      "Digital product/SaaS"
    ],
    "limitations": [
      "Payouts only to the 119 countries supported by Stripe Connect Express; individual sign-up depends on Stripe Connect Express supporting 'individual' in your country",
      "Payout fees passed through from Stripe ($2/month active account + 0.25% + $0.25 per payout)",
      "No sales to customers in US-sanctioned countries (Cuba, Russia, Iran, North Korea, Syria)"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://polar.sh/resources/pricing"
      },
      {
        "label": "Supported countries",
        "url": "https://polar.sh/docs/merchant-of-record/supported-countries"
      },
      {
        "label": "Docs index (framework adapters)",
        "url": "https://polar.sh/docs/llms.txt"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided",
    "detectAs": [
      "Polar"
    ]
  },
  {
    "id": "razorpay",
    "name": "Razorpay",
    "capability": "payments",
    "summary": "Payment gateway primarily for Indian businesses, also operating in Malaysia, Singapore and the US.",
    "website": "https://razorpay.com",
    "pricingModel": "Per-transaction fee, no setup or annual fee",
    "freeTier": "Rs. 0 setup fee and Rs. 0 annual maintenance",
    "fees": "2% per successful domestic transaction (India) + 18% GST on fee; international cards up to 3%",
    "merchantOfRecord": false,
    "sellerCountries": [
      "IN",
      "MY",
      "SG",
      "US"
    ],
    "businessTypes": [
      "individual",
      "sole_proprietor",
      "company"
    ],
    "frameworks": [],
    "setup": "days",
    "prerequisites": [
      "Business located in India, Malaysia, Singapore or the US",
      "KYC verification of the onboarding person and business (pathway differs for unregistered individuals, proprietorships and registered businesses)",
      "Website/app"
    ],
    "limitations": [
      "Seller is merchant of record; you handle tax compliance",
      "KYC/activation review required before live payments",
      "Pricing quoted is India-specific; other countries priced separately",
      "International payments require separate enablement"
    ],
    "sources": [
      {
        "label": "Pricing (India)",
        "url": "https://razorpay.com/pricing/"
      },
      {
        "label": "Account set-up / eligibility",
        "url": "https://razorpay.com/docs/payments/set-up/"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided",
    "detectAs": [
      "Razorpay"
    ]
  },
  {
    "id": "dodo-payments",
    "name": "Dodo Payments",
    "capability": "payments",
    "summary": "Merchant of record for SaaS and digital products that handles global tax, payments and payouts.",
    "website": "https://dodopayments.com",
    "pricingModel": "Per-transaction fee (MoR)",
    "freeTier": "No monthly fee stated; pay per transaction",
    "fees": "4% + 40¢ per domestic US transaction (cards & wallets)",
    "merchantOfRecord": true,
    "sellerCountries": [
      "AL",
      "AD",
      "AI",
      "AG",
      "AR",
      "AM",
      "AW",
      "AU",
      "AT",
      "AZ",
      "BS",
      "BH",
      "BB",
      "BE",
      "BZ",
      "BJ",
      "BM",
      "BT",
      "BO",
      "BA",
      "BW",
      "BR",
      "VG",
      "BN",
      "BG",
      "BF",
      "CV",
      "KH",
      "CA",
      "KY",
      "CL",
      "CN",
      "CO",
      "KM",
      "CK",
      "CR",
      "HR",
      "CW",
      "CY",
      "CZ",
      "DK",
      "DJ",
      "DM",
      "DO",
      "EC",
      "SV",
      "EE",
      "SZ",
      "ET",
      "FK",
      "FO",
      "FJ",
      "FI",
      "FR",
      "PF",
      "GA",
      "GM",
      "GE",
      "DE",
      "GH",
      "GI",
      "GR",
      "GL",
      "GD",
      "GU",
      "GT",
      "GG",
      "GN",
      "GW",
      "GY",
      "HN",
      "HK",
      "HU",
      "IS",
      "IN",
      "ID",
      "IE",
      "IM",
      "IL",
      "IT",
      "JM",
      "JP",
      "JE",
      "JO",
      "KZ",
      "KI",
      "KG",
      "LV",
      "LS",
      "LR",
      "LI",
      "LT",
      "LU",
      "MG",
      "MW",
      "MY",
      "MV",
      "ML",
      "MT",
      "MR",
      "MU",
      "MX",
      "MD",
      "MC",
      "MN",
      "ME",
      "MS",
      "MZ",
      "NA",
      "NP",
      "NL",
      "NC",
      "NZ",
      "NE",
      "MK",
      "NO",
      "OM",
      "PW",
      "PA",
      "PY",
      "PE",
      "PH",
      "PL",
      "PT",
      "PR",
      "QA",
      "KR",
      "RO",
      "RW",
      "KN",
      "LC",
      "MF",
      "PM",
      "VC",
      "WS",
      "SM",
      "ST",
      "SA",
      "SN",
      "RS",
      "SC",
      "SL",
      "SG",
      "SX",
      "SK",
      "SI",
      "SB",
      "ZA",
      "ES",
      "LK",
      "SR",
      "SE",
      "CH",
      "TW",
      "TJ",
      "TZ",
      "TH",
      "TL",
      "TG",
      "TO",
      "TT",
      "TN",
      "TR",
      "TM",
      "TC",
      "UG",
      "AE",
      "GB",
      "US",
      "UY",
      "UZ",
      "VU",
      "VN",
      "VI",
      "WF",
      "ZM",
      "ZW"
    ],
    "businessTypes": [
      "individual",
      "sole_proprietor",
      "company"
    ],
    "frameworks": [
      "Next.js"
    ],
    "setup": "hours",
    "prerequisites": [
      "Government-issued ID from an accepted country (for every director/beneficial owner for companies)",
      "Digital product/SaaS",
      "Account verification (KYC)"
    ],
    "limitations": [
      "Eligibility is based on the country that issued your ID, not where the company is registered",
      "Accepted-country list changes with FATF/OFAC/UN/EU directives; some countries only grandfathered",
      "Fee shown is for domestic US transactions; international surcharges may apply"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://dodopayments.com/pricing"
      },
      {
        "label": "Accepted merchant countries",
        "url": "https://docs.dodopayments.com/miscellaneous/accepted-countries-and-territories"
      },
      {
        "label": "Docs index / changelog (Next.js adapter)",
        "url": "https://docs.dodopayments.com/llms.txt"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided",
    "detectAs": [
      "Dodo Payments"
    ]
  },
  {
    "id": "clerk",
    "name": "Clerk",
    "capability": "auth",
    "summary": "Hosted authentication and user-management service with prebuilt UI components.",
    "website": "https://clerk.com",
    "pricingModel": "Free tier, then per monthly retained user (MRU)",
    "freeTier": "Hobby: 50,000 MRUs per app, no credit card",
    "fees": "Pro $25/mo ($20/mo billed annually), 50,000 MRUs included per app, then $0.02/MRU (50,001–100,000) with volume discounts",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [
      "Next.js",
      "React Router",
      "Remix",
      "Astro",
      "Nuxt",
      "Vue",
      "Express",
      "Fastify",
      "TanStack Start",
      "Expo"
    ],
    "setup": "minutes",
    "prerequisites": [
      "Clerk account and application",
      "Publishable and secret keys in env"
    ],
    "limitations": [
      "Vendor lock-in: user data and sessions hosted by Clerk",
      "Pricing scales with retained users beyond the included tier"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://clerk.com/pricing"
      },
      {
        "label": "Docs index (quickstarts)",
        "url": "https://clerk.com/docs/llms.txt"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided",
    "detectAs": [
      "Clerk"
    ]
  },
  {
    "id": "authjs",
    "name": "Auth.js (NextAuth.js)",
    "capability": "auth",
    "summary": "Open-source authentication library for JavaScript frameworks, now maintained by the Better Auth team.",
    "website": "https://authjs.dev",
    "pricingModel": "Free, open source (self-hosted)",
    "freeTier": "Free and open source",
    "fees": null,
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [
      "Next.js",
      "SvelteKit",
      "Express",
      "Qwik",
      "SolidStart"
    ],
    "setup": "hours",
    "prerequisites": [
      "OAuth provider credentials",
      "Database adapter for persistent sessions (optional)",
      "AUTH_SECRET env var"
    ],
    "limitations": [
      "Project is now part of Better Auth; maintainers commit to security patches and urgent issues but recommend new projects start with Better Auth",
      "You own and operate the auth stack (security, email delivery, session storage)"
    ],
    "sources": [
      {
        "label": "Homepage",
        "url": "https://authjs.dev/"
      },
      {
        "label": "Auth.js joins Better Auth",
        "url": "https://www.better-auth.com/blog/authjs-joins-better-auth"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided",
    "detectAs": [
      "Auth.js / NextAuth"
    ]
  },
  {
    "id": "supabase-auth",
    "name": "Supabase Auth",
    "capability": "auth",
    "summary": "Authentication service bundled with the Supabase Postgres platform.",
    "website": "https://supabase.com/auth",
    "pricingModel": "Free tier, then per-MAU on Pro plan",
    "freeTier": "50,000 MAUs; free projects pause after 1 week of inactivity; max 2 active free projects",
    "fees": "Pro from $25/month incl. 100,000 MAUs, then $0.00325 per MAU",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [
      "Next.js",
      "Astro",
      "React"
    ],
    "setup": "minutes",
    "prerequisites": [
      "Supabase project",
      "Project URL and anon/publishable key"
    ],
    "limitations": [
      "Free projects auto-pause after a week of inactivity",
      "Tightly coupled to Supabase Postgres (auth schema)"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://supabase.com/pricing"
      },
      {
        "label": "Auth quickstarts",
        "url": "https://supabase.com/docs/guides/auth/quickstarts/nextjs"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided",
    "detectAs": [
      "Supabase Auth"
    ]
  },
  {
    "id": "workos-authkit",
    "name": "WorkOS AuthKit",
    "capability": "auth",
    "summary": "Hosted authentication and user management from WorkOS with add-on enterprise SSO and directory sync.",
    "website": "https://workos.com/authkit",
    "pricingModel": "Free up to 1M MAUs, then per-million; SSO/SCIM per connection",
    "freeTier": "First 1M MAUs free",
    "fees": "$2,500/mo per additional 1M MAUs; SSO $125 per connection (1–15) with volume discounts",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [
      "Next.js",
      "Remix",
      "React Router",
      "TanStack Start",
      "Astro"
    ],
    "setup": "minutes",
    "prerequisites": [
      "WorkOS account",
      "API key and client ID",
      "Redirect URI configured"
    ],
    "limitations": [
      "Enterprise features (SSO, Directory Sync) billed per connection",
      "Hosted service: vendor lock-in for user data"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://workos.com/pricing"
      },
      {
        "label": "Docs index (SDKs)",
        "url": "https://workos.com/docs/llms.txt"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided",
    "detectAs": [
      "WorkOS"
    ]
  },
  {
    "id": "better-auth",
    "name": "Better Auth",
    "capability": "auth",
    "summary": "Open-source TypeScript authentication framework with an optional paid managed infrastructure dashboard.",
    "website": "https://www.better-auth.com",
    "pricingModel": "Free open-source library; optional paid managed infrastructure",
    "freeTier": "Framework free and open source; managed infrastructure free tier with 10,000 audit logs/month and 1,000 security detections/month",
    "fees": "Managed infrastructure paid plan $20/month (audit logs, security detection, SSO/SCIM $50/month per extra connection)",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [
      "Next.js",
      "Nuxt",
      "SvelteKit",
      "Astro",
      "Hono"
    ],
    "setup": "hours",
    "prerequisites": [
      "Database for users/sessions",
      "BETTER_AUTH_SECRET env var",
      "OAuth credentials for social providers"
    ],
    "limitations": [
      "Self-hosted: you operate the auth backend and database",
      "Managed dashboard features cost extra"
    ],
    "sources": [
      {
        "label": "Homepage",
        "url": "https://www.better-auth.com/"
      },
      {
        "label": "Pricing (managed infrastructure)",
        "url": "https://www.better-auth.com/pricing"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided",
    "detectAs": [
      "Better Auth"
    ]
  },
  {
    "id": "cloudflare-workers",
    "name": "Cloudflare Workers & Pages",
    "capability": "hosting",
    "summary": "Serverless edge compute and static/full-stack hosting on Cloudflare's network.",
    "website": "https://workers.cloudflare.com",
    "pricingModel": "Free tier, then $5/month minimum plus usage",
    "freeTier": "100,000 requests/day, 10 ms CPU time per invocation",
    "fees": "Workers Paid: $5/month minimum, 10M requests and 30M CPU-ms included, then $0.30/additional million requests and $0.02/additional million CPU-ms",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [
      "Next.js",
      "Remix",
      "React Router",
      "SvelteKit",
      "Nuxt",
      "Astro",
      "Vite",
      "Hono",
      "TanStack Start",
      "Angular",
      "Gatsby"
    ],
    "setup": "minutes",
    "prerequisites": [
      "Cloudflare account",
      "Wrangler CLI or Git integration"
    ],
    "limitations": [
      "Workers runtime is not full Node.js; some npm packages need compatibility flags",
      "Free plan CPU limit of 10 ms per invocation",
      "Cloudflare documents migrating Pages projects to Workers static assets"
    ],
    "sources": [
      {
        "label": "Workers pricing",
        "url": "https://developers.cloudflare.com/workers/platform/pricing/"
      },
      {
        "label": "Framework guides",
        "url": "https://developers.cloudflare.com/workers/framework-guides/"
      },
      {
        "label": "Migrate from Pages",
        "url": "https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided",
    "detectAs": [
      "Cloudflare"
    ]
  },
  {
    "id": "vercel",
    "name": "Vercel",
    "capability": "hosting",
    "summary": "Frontend and full-stack hosting platform from the creators of Next.js.",
    "website": "https://vercel.com",
    "pricingModel": "Free Hobby plan; Pro per developer seat plus usage",
    "freeTier": "Hobby: $0, for personal, non-commercial use",
    "fees": "Pro $20/month per developer seat, includes $20 monthly usage credit",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [
      "Next.js",
      "SvelteKit",
      "Nuxt",
      "Remix",
      "Astro",
      "React Router",
      "Vite",
      "Express",
      "Hono",
      "TanStack Start"
    ],
    "setup": "minutes",
    "prerequisites": [
      "Vercel account",
      "Git repository (GitHub/GitLab/Bitbucket) or Vercel CLI"
    ],
    "limitations": [
      "Hobby plan is non-commercial only; a commercial launch requires Pro",
      "Usage-based overages beyond included credit"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://vercel.com/pricing"
      },
      {
        "label": "Frameworks",
        "url": "https://vercel.com/docs/frameworks"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided",
    "detectAs": [
      "Vercel"
    ]
  },
  {
    "id": "netlify",
    "name": "Netlify",
    "capability": "hosting",
    "summary": "Web hosting platform for static sites and serverless functions with Git-based deploys.",
    "website": "https://www.netlify.com",
    "pricingModel": "Credit-based usage plans",
    "freeTier": "Free plan with 300 credits/month",
    "fees": "Personal $9/month (1,000 credits); Pro $20/month (3,000 credits); extra credits $10 per 1,500",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [
      "Next.js",
      "Remix",
      "React Router",
      "SvelteKit",
      "Nuxt",
      "Astro",
      "Vite",
      "Angular",
      "Gatsby",
      "TanStack Start",
      "Express"
    ],
    "setup": "minutes",
    "prerequisites": [
      "Netlify account",
      "Git repository or Netlify CLI"
    ],
    "limitations": [
      "Credit-based billing: deploys, compute, bandwidth and requests all consume credits",
      "Free plan stops at its credit limit"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://www.netlify.com/pricing/"
      },
      {
        "label": "Frameworks",
        "url": "https://docs.netlify.com/build/frameworks/overview/"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided",
    "detectAs": [
      "Netlify"
    ]
  },
  {
    "id": "fly-io",
    "name": "Fly.io",
    "capability": "hosting",
    "summary": "Platform for running containerized apps as Firecracker micro-VMs in regions worldwide.",
    "website": "https://fly.io",
    "pricingModel": "Usage-based (per-second compute, provisioned storage)",
    "freeTier": "Free trial only: 2 machine-hours or 7 days, whichever comes first",
    "fees": "From $2.19/month for shared-cpu-1x 256MB machine",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [
      "Rails",
      "Laravel",
      "Django"
    ],
    "setup": "hours",
    "prerequisites": [
      "flyctl CLI",
      "Dockerfile or supported buildpack",
      "Credit card after trial"
    ],
    "limitations": [
      "No ongoing free tier; apps stop when trial ends without a payment method",
      "More ops responsibility than serverless platforms (VMs, volumes, regions)"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://fly.io/pricing/"
      },
      {
        "label": "Free trial",
        "url": "https://docs.fly.io/about/free-trial"
      },
      {
        "label": "Languages & frameworks",
        "url": "https://fly.io/docs/languages-and-frameworks/"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided",
    "detectAs": [
      "Fly.io"
    ]
  },
  {
    "id": "render",
    "name": "Render",
    "capability": "hosting",
    "summary": "Cloud platform for web services, static sites, workers and managed Postgres.",
    "website": "https://render.com",
    "pricingModel": "Workspace plan fee plus per-instance compute",
    "freeTier": "Hobby workspace $0; free web services (750 instance hours/month) spin down after 15 minutes idle",
    "fees": "Pro workspace $25/month + compute; paid web services from $7/month (512 MB)",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [
      "Next.js",
      "Astro",
      "Express",
      "Django",
      "Flask",
      "FastAPI",
      "Rails",
      "Phoenix"
    ],
    "setup": "minutes",
    "prerequisites": [
      "Render account",
      "Git repository"
    ],
    "limitations": [
      "Free web services spin down after 15 min without traffic (~1 min cold start) and have an ephemeral filesystem",
      "Free Postgres has limits (see free tier docs)"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://render.com/pricing"
      },
      {
        "label": "Free tier",
        "url": "https://render.com/docs/free"
      },
      {
        "label": "First deploy guides",
        "url": "https://render.com/docs/your-first-deploy"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided",
    "detectAs": [
      "Render"
    ]
  },
  {
    "id": "sentry",
    "name": "Sentry",
    "capability": "error_tracking",
    "summary": "Application error monitoring and performance tracing with SDKs for most languages and frameworks.",
    "website": "https://sentry.io",
    "pricingModel": "Free single-user tier, then subscription by event volume",
    "freeTier": "Developer: 1 user, 5,000 errors/month",
    "fees": "Team $26/mo billed annually (50,000 errors/month, unlimited users); Business $80/mo billed annually",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [
      "Next.js",
      "Remix",
      "React Router",
      "SvelteKit",
      "Nuxt",
      "Astro",
      "Express",
      "Hono",
      "Angular",
      "TanStack Start",
      "Rails",
      "Laravel"
    ],
    "setup": "minutes",
    "prerequisites": [
      "Sentry account and project DSN",
      "Source map upload configured for readable stack traces"
    ],
    "limitations": [
      "Free plan limited to one user",
      "Event quotas; overages or dropped events beyond plan volume"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://sentry.io/pricing/"
      },
      {
        "label": "Docs index (platforms)",
        "url": "https://docs.sentry.io/llms.txt"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided"
  },
  {
    "id": "honeybadger",
    "name": "Honeybadger",
    "capability": "error_tracking",
    "summary": "Error tracking, uptime and check-in monitoring service for web apps.",
    "website": "https://www.honeybadger.io",
    "pricingModel": "Free developer tier, then subscription",
    "freeTier": "Developer: 1 user, 5,000 errors/month, 15-day retention",
    "fees": "Team from $26/mo ($286/yr)",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [
      "Next.js",
      "Rails",
      "Laravel",
      "Django",
      "Angular"
    ],
    "setup": "minutes",
    "prerequisites": [
      "Honeybadger account and project API key"
    ],
    "limitations": [
      "Smaller ecosystem than Sentry",
      "Free plan limited to one user and 15-day retention"
    ],
    "sources": [
      {
        "label": "Plans",
        "url": "https://www.honeybadger.io/plans/"
      },
      {
        "label": "JavaScript docs",
        "url": "https://docs.honeybadger.io/lib/javascript/"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided"
  },
  {
    "id": "uptimerobot",
    "name": "UptimeRobot",
    "capability": "uptime",
    "summary": "Website and API uptime monitoring with alerts and status pages.",
    "website": "https://uptimerobot.com",
    "pricingModel": "Free tier, then subscription by monitors/interval",
    "freeTier": "50 monitors, 5-minute interval; described as for hobby and non-profit projects",
    "fees": "Solo from $12/month billed annually ($144/yr)",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [],
    "setup": "minutes",
    "prerequisites": [
      "UptimeRobot account",
      "Public URL to monitor"
    ],
    "limitations": [
      "Free plan positioned for hobby/non-profit use; only 5 integrations, no login seats",
      "API rate limit 10 req/min on Free"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://uptimerobot.com/pricing/"
      },
      {
        "label": "API",
        "url": "https://uptimerobot.com/api/"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "integrated"
  },
  {
    "id": "better-stack",
    "name": "Better Stack",
    "capability": "uptime",
    "summary": "Uptime monitoring, incident management, status pages and observability platform.",
    "website": "https://betterstack.com",
    "pricingModel": "Free tier, then per-responder license plus add-ons",
    "freeTier": "10 monitors & heartbeats, 1 status page, Slack & e-mail alerts",
    "fees": "Responder license $34/month ($29/month billed annually); extra 50 monitors $25/month",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [],
    "setup": "minutes",
    "prerequisites": [
      "Better Stack account",
      "Public URL to monitor"
    ],
    "limitations": [
      "Phone/SMS alerting and on-call require a paid responder license",
      "Pricing spans many products; costs add up with add-ons"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://betterstack.com/pricing"
      },
      {
        "label": "Uptime API",
        "url": "https://betterstack.com/docs/uptime/api/list-all-existing-monitors/"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "integrated"
  },
  {
    "id": "resend",
    "name": "Resend",
    "capability": "email",
    "summary": "Developer-focused transactional email API with React Email support.",
    "website": "https://resend.com",
    "pricingModel": "Free tier, then monthly plans by email volume",
    "freeTier": "3,000 emails/month, 100 emails/day",
    "fees": "Pro $20/mo for 50,000 emails; extra emails $0.90 per 1,000",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [
      "Next.js",
      "Remix",
      "SvelteKit",
      "Nuxt",
      "Astro",
      "Express",
      "Hono",
      "TanStack Start",
      "Rails",
      "Django",
      "Laravel"
    ],
    "setup": "minutes",
    "prerequisites": [
      "Verified sending domain (DNS: SPF/DKIM records)",
      "API key"
    ],
    "limitations": [
      "Daily cap of 100 emails on free plan",
      "DNS verification needed before sending from your domain"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://resend.com/pricing"
      },
      {
        "label": "Docs index",
        "url": "https://resend.com/docs/llms.txt"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided"
  },
  {
    "id": "postmark",
    "name": "Postmark",
    "capability": "email",
    "summary": "Transactional email delivery service focused on deliverability.",
    "website": "https://postmarkapp.com",
    "pricingModel": "Monthly plans by email volume",
    "freeTier": "Developer: 100 emails/month for testing",
    "fees": "Basic $15.00/mo for 10,000 emails; extra emails $1.80 per 1,000",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [],
    "setup": "hours",
    "prerequisites": [
      "Sender signature or verified domain (DKIM/Return-Path DNS)",
      "Account approval before sending to arbitrary recipients"
    ],
    "limitations": [
      "Free tier is for testing only (100 emails/month)",
      "New accounts are reviewed before full sending is enabled"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://postmarkapp.com/pricing"
      },
      {
        "label": "Account approval process",
        "url": "https://postmarkapp.com/support/article/1084-how-does-the-account-approval-process-work"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided"
  },
  {
    "id": "amazon-ses",
    "name": "Amazon SES",
    "capability": "email",
    "summary": "AWS's pay-as-you-go email sending service.",
    "website": "https://aws.amazon.com/ses/",
    "pricingModel": "Pay as you go per email",
    "freeTier": "New AWS customers get up to $200 in AWS Free Tier credits usable on SES (credits expire within 12 months)",
    "fees": "$0.10 per 1,000 outbound emails (+$0.12 per GB of attachments)",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [],
    "setup": "days",
    "prerequisites": [
      "AWS account",
      "Verified domain/identity",
      "Request production access to leave the SES sandbox"
    ],
    "limitations": [
      "New accounts start in a sandbox (verified recipients only) until production access is approved",
      "More configuration (IAM, DNS, bounce/complaint handling) than developer-focused providers"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://aws.amazon.com/ses/pricing/"
      },
      {
        "label": "Moving out of the SES sandbox",
        "url": "https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided"
  },
  {
    "id": "plausible",
    "name": "Plausible",
    "capability": "analytics",
    "summary": "Privacy-friendly, cookieless, EU-hosted web analytics.",
    "website": "https://plausible.io",
    "pricingModel": "Subscription by monthly pageviews",
    "freeTier": null,
    "fees": "Starter from $9/month (up to 10k monthly pageviews, one site); 30-day free trial, no credit card",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [
      "Next.js",
      "Nuxt",
      "Angular"
    ],
    "setup": "minutes",
    "prerequisites": [
      "Plausible account",
      "Add script tag to site"
    ],
    "limitations": [
      "No free plan on cloud (trial only); self-hosted Community Edition is free",
      "Web analytics only (no product analytics/session replay)"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://plausible.io/#pricing"
      },
      {
        "label": "Integration guides",
        "url": "https://plausible.io/docs/integration-guides"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided"
  },
  {
    "id": "posthog",
    "name": "PostHog",
    "capability": "analytics",
    "summary": "Product analytics suite with session replay, feature flags and experiments.",
    "website": "https://posthog.com",
    "pricingModel": "Generous free monthly allowance, then usage-based",
    "freeTier": "1M analytics events, 5K session recordings, 1M feature-flag requests per month",
    "fees": "$0.00005 per event after the first 1M (product analytics)",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [
      "Next.js",
      "React Router",
      "Remix",
      "Nuxt",
      "SvelteKit",
      "Astro",
      "Angular",
      "TanStack Start",
      "Vite",
      "Rails",
      "Django",
      "Laravel"
    ],
    "setup": "minutes",
    "prerequisites": [
      "PostHog project API key",
      "Choose US or EU cloud region"
    ],
    "limitations": [
      "Usage-based billing can grow with traffic",
      "Client-side tracking can be blocked by ad blockers unless proxied"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://posthog.com/pricing"
      },
      {
        "label": "Docs index",
        "url": "https://posthog.com/llms.txt"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided"
  },
  {
    "id": "umami-cloud",
    "name": "Umami Cloud",
    "capability": "analytics",
    "summary": "Hosted version of the open-source, privacy-focused Umami web analytics.",
    "website": "https://umami.is",
    "pricingModel": "Free Hobby tier, then subscription by events",
    "freeTier": "Hobby: up to 100K events/month, 1 website, 6-month retention",
    "fees": "Pro $20/month incl. 1M events, then $0.00003 per additional event",
    "merchantOfRecord": null,
    "sellerCountries": null,
    "businessTypes": null,
    "frameworks": [],
    "setup": "minutes",
    "prerequisites": [
      "Umami Cloud account",
      "Add tracking script to site"
    ],
    "limitations": [
      "Free plan limited to 1 website and 6 months data retention",
      "Web analytics only"
    ],
    "sources": [
      {
        "label": "Pricing",
        "url": "https://umami.is/pricing"
      }
    ],
    "verifiedAt": "2026-10-15",
    "integration": "guided"
  }
];
