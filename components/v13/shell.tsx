import { signOut } from "@/app/auth/actions";
import { HideAmounts } from "@/components/hide-amounts";
import { ThemeToggle } from "@/components/theme-toggle";
import { FeedbackProvider } from "./feedback";
import { PhoneTabs, RailLinks, type NavItem } from "./nav-links";
import { QuickAddProvider, type QuickAddAccount, type QuickAddCategory } from "./quick-add";

/**
 * The rehaul shell: a 216px rail on desktop, five tabs on a phone (Now, Inbox, + quick add, Accounts, Plan).
 * Destinations whose pages land in later slices either point at the existing page (Salary, Budget, Bonuses, Funds, Accounts,
 * Settings) or show as unavailable (Forecast). Quick add is the + tab on a phone and the N key on desktop.
 */
export function V13Shell({ children, pending, accounts, categories }: { children: React.ReactNode; pending: number; accounts: QuickAddAccount[]; categories: QuickAddCategory[] }) {
  const today: NavItem[] = [
    { label: "Now", icon: "now", href: "/" },
    { label: "Inbox", icon: "inbox", href: "/inbox", badge: pending },
    { label: "Accounts", icon: "wallet", href: "/accounts" },
  ];
  const plan: NavItem[] = [
    { label: "Salary and tax", icon: "salary", href: "/pay" },
    { label: "Budget", icon: "budget", href: "/budget", also: ["/installments", "/subscriptions"] },
    { label: "Bonuses", icon: "gift", href: "/bonuses" },
    { label: "Funds", icon: "fund", href: "/funds" },
    { label: "Forecast", icon: "forecast", href: "/forecast" },
  ];
  return (
    <div className="v13">
      <FeedbackProvider>
      <QuickAddProvider accounts={accounts} categories={categories}>
        <div className="v-app">
          <nav className="v-rail" aria-label="Main">
            <div className="v-logo">
              <span className="v-pip" style={{ width: 30, height: 30 }} aria-hidden="true" />
              Bad(yet)
            </div>
            <div className="v-grp">Today</div>
            <RailLinks items={today} />
            <div className="v-grp">Plan</div>
            <RailLinks items={plan} />
            <div className="v-foot">
              <RailLinks items={[{ label: "Settings", icon: "settings", href: "/settings" }]} />
              <div className="v-tools">
                <ThemeToggle className="v-railbtn" />
                <HideAmounts className="v-railbtn" withIcon />
                <form action={signOut}>
                  <button type="submit" className="v-railbtn">
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </nav>
          <div className="v-content">{children}</div>
        </div>
        <PhoneTabs
          inbox={today[1]!}
          plan={{ label: "More", icon: "plan", href: "/budget", also: ["/pay", "/bonuses", "/funds", "/forecast", "/installments", "/subscriptions"] }}
          more={
            <div className="v-more">
              <RailLinks items={[...plan, { label: "Settings", icon: "settings", href: "/settings" }]} />
              <hr className="v-hr" />
              <ThemeToggle className="v-railbtn" />
              <HideAmounts className="v-railbtn" withIcon />
              <form action={signOut}>
                <button type="submit" className="v-railbtn">Sign out</button>
              </form>
            </div>
          }
        />
      </QuickAddProvider>
      </FeedbackProvider>
    </div>
  );
}
