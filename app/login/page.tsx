"use client";

import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <main className="page">
        <div className="notice info">
          Sign-in isn&apos;t configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY (see .env.example). In development, ProductRoot runs as a single local user.
        </div>
      </main>
    );
  }
  return (
    <main className="page auth-page">
      <div className="auth-copy">
        <h1>Welcome to ProductRoot</h1>
        <p className="sub">Sign in or create an account to assess your product and get a launch plan. Use the same account as MetaInfo and SocialBrewery.</p>
      </div>
      <SignIn routing="hash" withSignUp fallbackRedirectUrl="/projects" signUpFallbackRedirectUrl="/projects" />
    </main>
  );
}
