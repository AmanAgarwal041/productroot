import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Gives `next dev` the Worker's bindings (a local D1 under .wrangler/state).
// Apply schema changes with `npm run db:migrate:local`.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // No floating dev badge (keeps local screenshots clean).
  devIndicators: false,
  outputFileTracingExcludes: {
    "*": ["node_modules/next/dist/compiled/@vercel/og/**"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
