"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface Item {
  label: string;
  href?: string;
  /** Other paths that should also light this item up (the More tab covers the pages it links to). */
  also?: string[];
}

// Only destinations that exist are links; the rest show as disabled until their slice lands.
// Four destinations. The rest live inside them (see SubNav): Month holds the budget and its commitments, Setup holds the rarely changed pages.
const NOW: Item = { label: "Now", href: "/", also: ["/transfer"] };
const MONTH: Item = { label: "Month", href: "/budget", also: ["/installments", "/subscriptions", "/bonuses"] };
const SAVINGS: Item = { label: "Savings", href: "/savings" };
const SETUP: Item = { label: "Setup", href: "/plans", also: ["/pay", "/settings", "/import", "/more"] };
export const SIDE_ITEMS: Item[] = [NOW, MONTH, SAVINGS, SETUP];
export const TAB_ITEMS: Item[] = [NOW, MONTH, SAVINGS, SETUP];

// Pages that follow the chosen cutoff. Their links carry it along, so picking "2nd" once sticks as you move around.
const CUTOFF_PAGES = ["/", "/budget", "/transfer"];
// Pages that can show a plan other than the active one.
const PLAN_PAGES = ["/", "/budget", "/transfer", "/savings"];

export function NavLinks({ items }: { items: Item[] }) {
  const path = usePathname();
  const sp = useSearchParams();
  const cutoff = sp.get("cutoff");
  const plan = sp.get("plan");
  const keepCutoff = cutoff === "first" || cutoff === "second" ? `cutoff=${cutoff}` : "";
  const keepPlan = plan && /^[0-9a-f-]{36}$/i.test(plan) ? `plan=${plan}` : "";
  const withKept = (href: string) => {
    const qs = [CUTOFF_PAGES.includes(href) ? keepCutoff : "", PLAN_PAGES.includes(href) ? keepPlan : ""].filter(Boolean).join("&");
    return qs ? `${href}?${qs}` : href;
  };
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
          <Link key={label} href={withKept(href)} aria-current={current ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </>
  );
}
