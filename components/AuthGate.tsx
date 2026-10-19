"use client";

// With Clerk configured, app pages require a signed-in user. The landing page
// and /login stay public. The API enforces this independently (lib/server/auth.ts);
// this only gives signed-out visitors a sign-in screen instead of errors.

import { SignIn, useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const PUBLIC = new Set(["/", "/login"]);

export default function AuthGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  if (PUBLIC.has(path)) return <>{children}</>;
  if (!isLoaded)
    return (
      <main className="page">
        <div className="skeleton" style={{ height: 28, width: 220 }} />
        <div className="skeleton" style={{ height: 240, marginTop: 20 }} />
      </main>
    );
  if (!isSignedIn)
    return (
      <main className="page auth-page">
        <div className="auth-copy">
          <h1>Sign in to ProductRoot</h1>
          <p className="sub">Your projects, provider choices and approvals are saved to your account, or shared with your team when you switch to an organisation.</p>
        </div>
        <SignIn routing="hash" withSignUp fallbackRedirectUrl={path} signUpFallbackRedirectUrl={path} />
      </main>
    );
  return <>{children}</>;
}
