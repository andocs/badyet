import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

// Only the dashboard exists in Slice 1; other destinations are shown but disabled.
const NAV = ["Dashboard", "Cutoff", "Pay", "Budget", "Installments", "Subscriptions", "Bonuses", "Savings"];
const TABS = ["Home", "Cutoff", "Budget", "Savings", "More"];

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <i aria-hidden="true" />
          Bad(yet)
        </div>
        <nav aria-label="Main">
          {NAV.map((label, i) =>
            i === 0 ? (
              <Link key={label} href="/" aria-current="page">
                {label}
              </Link>
            ) : (
              <span key={label} className="off" aria-disabled="true">
                {label}
              </span>
            ),
          )}
        </nav>
        <ThemeToggle />
      </aside>
      <div className="content">{children}</div>
      <nav className="mnav" aria-label="Main">
        {TABS.map((label, i) =>
          i === 0 ? (
            <Link key={label} href="/" aria-current="page">
              {label}
            </Link>
          ) : (
            <span key={label} aria-disabled="true">
              {label}
            </span>
          ),
        )}
      </nav>
    </div>
  );
}
