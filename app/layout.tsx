import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import AuthGate from "@/components/AuthGate";
import TopBar from "@/components/TopBar";
// xyflow styles live here, not in components/LaunchMap.tsx: importing them from a
// server-rendered client component put Turbopack's dev client into a
// CSS-update → full-reload loop on the landing page.
import "@xyflow/react/dist/style.css";
import "./globals.css";

const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { default: "ProductRoot: from working code to a launched product", template: "%s | ProductRoot" },
  description:
    "Connect your repository and website, see what's missing before launch, and follow a prioritised plan grounded in evidence from your own product.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fa" },
    { media: "(prefers-color-scheme: dark)", color: "#121317" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const body = (
    <body>
      <TopBar clerk={clerk} />
      {clerk ? <AuthGate>{children}</AuthGate> : children}
    </body>
  );
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      {clerk ? <ClerkProvider afterSignOutUrl="/">{body}</ClerkProvider> : body}
    </html>
  );
}
