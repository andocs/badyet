"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Item {
  label: string;
  href?: string;
  /** Other paths that should also light this item up (the More tab covers the pages it links to). */
  also?: string[];
}

// Only destinations that exist are links; the rest show as disabled until their slice lands.
export const SIDE_ITEMS: Item[] = [
  { label: "Dashboard", href: "/" },
  { label: "Plans", href: "/plans" },
  { label: "Cutoff", href: "/transfer" },
  { label: "Pay", href: "/pay" },
  { label: "Budget", href: "/budget" },
  { label: "Installments", href: "/installments" },
  { label: "Subscriptions", href: "/subscriptions" },
  { label: "Bonuses", href: "/bonuses" },
  { label: "Savings", href: "/savings" },
  { label: "Settings", href: "/settings" },
];
export const TAB_ITEMS: Item[] = [
  { label: "Home", href: "/" },
  { label: "Plans", href: "/plans" },
  { label: "Transfer", href: "/transfer" },
  { label: "Budget", href: "/budget" },
  { label: "More", href: "/more", also: ["/pay", "/bonuses", "/installments", "/subscriptions", "/savings", "/settings"] },
];

export function NavLinks({ items }: { items: Item[] }) {
  const path = usePathname();
  return (
    <>
      {items.map((item) => {
        const { label, href, also } = item;
        if (!href) {
          return (
            <span key={label} className="off" aria-disabled="true">
              {label}
            </span>
          );
        }
        const at = (p: string) => (p === "/" ? path === "/" : path === p || path.startsWith(`${p}/`));
        const current = at(href) || (also ?? []).some(at);
        return (
          <Link key={label} href={href} aria-current={current ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </>
  );
}
