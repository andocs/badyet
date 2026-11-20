"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { V13Icon, type V13IconName } from "./icons";
import { QuickAddButton } from "./quick-add";

export interface NavItem {
  label: string;
  icon: V13IconName;
  href?: string;
  /** Paths that also light this item up. */
  also?: string[];
  badge?: number;
}

const here = (path: string, p: string) => (p === "/" ? path === "/" : path === p || path.startsWith(`${p}/`));
const isCurrent = (path: string, item: NavItem) => !!item.href && (here(path, item.href) || (item.also ?? []).some((p) => here(path, p)));

/** The desktop rail's links. An item without an href is a page that arrives in a later slice and shows as unavailable. */
export function RailLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <>
      {items.map((item) =>
        item.href ? (
          <Link key={item.label} href={item.href} aria-current={isCurrent(path, item) ? "page" : undefined}>
            <V13Icon name={item.icon} />
            {item.label}
            {item.badge ? <span className="v-badge" aria-label={`${item.badge} to check`}>{item.badge}</span> : null}
          </Link>
        ) : (
          <span key={item.label} className="v-off" aria-disabled="true" title="Coming soon">
            <V13Icon name={item.icon} />
            {item.label}
          </span>
        ),
      )}
    </>
  );
}

/** The phone's five tabs: Now, Inbox, + (quick add), Accounts, Plan. */
export function PhoneTabs({ inbox, plan }: { inbox: NavItem; plan: NavItem }) {
  const path = usePathname();
  const tab = (item: NavItem) => (
    <Link key={item.label} href={item.href!} aria-current={isCurrent(path, item) ? "page" : undefined}>
      <V13Icon name={item.icon} />
      {item.label}
      {item.badge ? <span className="v-badge" aria-label={`${item.badge} to check`}>{item.badge}</span> : null}
    </Link>
  );
  return (
    <nav className="v-tabs" aria-label="Main tabs">
      {tab({ label: "Now", icon: "now", href: "/" })}
      {tab(inbox)}
      <QuickAddButton className="v-add" label="Quick add">
        <span className="v-fab"><V13Icon name="plus" /></span>
      </QuickAddButton>
      {tab({ label: "Accounts", icon: "wallet", href: "/accounts" })}
      {tab(plan)}
    </nav>
  );
}
