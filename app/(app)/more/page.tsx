import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/theme-toggle";

// The phone's "More" tab: every destination that does not fit in the bottom bar, plus theme and sign out
// (the left rail that holds them on desktop is hidden on a phone).
const GROUPS: { title: string; items: { label: string; href: string; hint: string }[] }[] = [
  {
    title: "Money",
    items: [
      { label: "Pay", href: "/pay", hint: "Salary, tax and what lands in your account" },
      { label: "Bonuses", href: "/bonuses", hint: "13th month, CIP and where it goes" },
      { label: "Savings forecast", href: "/savings", hint: "How your funds grow, month by month" },
    ],
  },
  {
    title: "Commitments",
    items: [
      { label: "Installments", href: "/installments", hint: "Things you are paying off" },
      { label: "Subscriptions", href: "/subscriptions", hint: "Monthly charges" },
    ],
  },
];

export default function MorePage() {
  return (
    <main className="main">
      <div className="head">
        <div>
          <h1>More</h1>
          <p className="sub">Everything else in Bad(yet).</p>
        </div>
      </div>
      {GROUPS.map((g) => (
        <section key={g.title} className="card more-group" aria-labelledby={`g-${g.title}`}>
          <h2 id={`g-${g.title}`}>{g.title}</h2>
          {g.items.map((i) => (
            <Link key={i.href} href={i.href} className="more-item">
              <span>
                <b>{i.label}</b>
                <small className="lab">{i.hint}</small>
              </span>
              <span aria-hidden="true">›</span>
            </Link>
          ))}
        </section>
      ))}
      <section className="card more-group" aria-labelledby="g-app">
        <h2 id="g-app">App</h2>
        <div className="more-actions">
          <ThemeToggle />
          <form action={signOut}>
            <button type="submit" className="btn ghost">Sign out</button>
          </form>
        </div>
      </section>
    </main>
  );
}
