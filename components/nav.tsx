"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Item { label: string; href?: string }

// Only destinations that exist are links; the rest show as disabled until their slice lands.
export const SIDE_ITEMS: Item[] = [
  { label: "Dashboard", href: "/" },
  { label: "Plans", href: "/plans" },
  { label: "Cutoff" },
  { label: "Pay", href: "/pay" },
  { label: "Budget" },
  { label: "Installments" },
  { label: "Subscriptions" },
  { label: "Bonuses" },
  { label: "Savings" },
];
export const TAB_ITEMS: Item[] = [
  { label: "Home", href: "/" },
  { label: "Plans", href: "/plans" },
  { label: "Budget" },
  { label: "Savings" },
  { label: "More" },
];

export function NavLinks({ items }: { items: Item[] }) {
  const path = usePathname();
  return (
    <>
      {items.map((item) => {
        const { label, href } = item;
        if (!href) {
          return (
            <span key={label} className="off" aria-disabled="true">
              {label}
            </span>
          );
        }
        const current = href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
        return (
          <Link key={label} href={href} aria-current={current ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </>
  );
}
