"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher, UserButton, useAuth } from "@clerk/nextjs";
import Logo from "./Logo";
import NotificationBell from "./NotificationBell";

const NAV = [
  { href: "/projects", label: "Projects" },
  { href: "/approvals", label: "Approvals" },
  { href: "/integrations", label: "Integrations" },
];

// Clerk Core 3 dropped <SignedIn>/<SignedOut>; useAuth works in any client component.
function Account() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn)
    return (
      <Link className="btn btn-sm" href="/login">
        Sign in
      </Link>
    );
  return (
    <>
      <NotificationBell />
      <OrganizationSwitcher hidePersonal={false} afterSelectOrganizationUrl="/projects" afterSelectPersonalUrl="/projects" />
      <UserButton />
    </>
  );
}

export default function TopBar({ clerk }: { clerk: boolean }) {
  const path = usePathname();
  const app = path !== "/";
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="ProductRoot home">
        <Logo />
        <span>ProductRoot</span>
      </Link>
      <nav className="nav" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={path.startsWith(n.href) ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="topbar-end">
        {clerk ? (
          <Account />
        ) : (
          <>
            {app && process.env.NODE_ENV !== "production" && <NotificationBell />}
            <span className="badge plain" title={process.env.NODE_ENV === "production" ? "Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY." : "Sign-in isn't configured; running as a single local user."}>
              {process.env.NODE_ENV === "production" ? "Sign-in not configured" : "Local mode"}
            </span>
          </>
        )}
      </div>
    </header>
  );
}
