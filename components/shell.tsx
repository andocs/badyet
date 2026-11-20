import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { NavLinks, SIDE_ITEMS, TAB_ITEMS } from "./nav";
import { ThemeToggle } from "./theme-toggle";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <i aria-hidden="true" />
          Bad(yet)
        </div>
        <nav aria-label="Main">
          <Suspense fallback={null}>
            <NavLinks items={SIDE_ITEMS} />
          </Suspense>
        </nav>
        <ThemeToggle />
        <form action={signOut} className="signout">
          <button type="submit" className="btn ghost">Sign out</button>
        </form>
      </aside>
      <div className="content">{children}</div>
      <nav className="mnav" aria-label="Main">
        <Suspense fallback={null}>
          <NavLinks items={TAB_ITEMS} />
        </Suspense>
      </nav>
    </div>
  );
}
