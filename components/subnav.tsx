"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = {
  month: { label: "Month sections", items: [["Budget", "/budget"], ["Installments", "/installments"], ["Subscriptions", "/subscriptions"], ["Bonuses", "/bonuses"]] },
  setup: { label: "Setup sections", items: [["Plans", "/plans"], ["Accounts", "/accounts"], ["Pay", "/pay"], ["Settings", "/settings"], ["Import", "/import"]] },
} as const;

// The four main destinations hold several pages each; this strip moves between the pages of one destination.
export function SubNav({ group }: { group: keyof typeof GROUPS }) {
  const path = usePathname();
  const g = GROUPS[group];
  return (
    <nav className="segmented" aria-label={g.label} style={{ maxWidth: "100%", overflowX: "auto", marginBottom: 18 }}>
      {g.items.map(([label, href]) => (
        <Link key={href} href={href} aria-current={path === href || path.startsWith(`${href}/`) ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
