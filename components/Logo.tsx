/** A seedling over a root line: the product grows from what's below. */
export default function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="6" fill="var(--accent)" />
      <path d="M12 17V10.5" stroke="var(--accent-ink)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 11.5c0-2.6 1.9-4.3 4.6-4.3 0 2.6-1.9 4.3-4.6 4.3Z" fill="var(--accent-ink)" />
      <path d="M12 13c0-2.1-1.6-3.6-3.9-3.6 0 2.1 1.6 3.6 3.9 3.6Z" fill="var(--accent-ink)" opacity=".75" />
      <path d="M6.5 17h11M9 17l-1.5 2.5M15 17l1.5 2.5M12 17v2.5" stroke="var(--accent-ink)" strokeWidth="1.4" strokeLinecap="round" opacity=".8" />
    </svg>
  );
}
