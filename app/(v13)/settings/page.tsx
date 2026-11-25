import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { HideAmounts } from "@/components/hide-amounts";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsCard, PaydaysCard } from "@/components/v13/settings";
import { EXPORTS } from "@/lib/export/csv";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings · Bad(yet)" };

export default async function Settings() {
  const supabase = await createClient();
  if (!supabase) return <p className="v-main">Supabase is not configured.</p>;
  const [s, rulesRes, catRes] = await Promise.all([
    supabase.from("user_settings").select("first_payday_day, second_payday_day, notif_capture_enabled").maybeSingle(),
    supabase.from("merchant_rules").select("id, pattern, category_id").order("created_at"),
    supabase.from("categories").select("id, name, archived_at").order("sort"),
  ]);
  const row = (s.data as { first_payday_day: number; second_payday_day: number; notif_capture_enabled: boolean } | null) ?? { first_payday_day: 10, second_payday_day: 25, notif_capture_enabled: false };
  const cat = new Map(((catRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const rules = ((rulesRes.data ?? []) as { id: string; pattern: string; category_id: string }[]).map((r) => ({ id: r.id, pattern: r.pattern, category: cat.get(r.category_id) ?? "a category" }));

  return (
    <main className="v-main">
      <div className="v-narrow v-stack">
        <div><h1>Settings</h1><div className="v-lbl">Plain and short. Everything about money lives in Plan.</div></div>
        <PaydaysCard first={row.first_payday_day} second={row.second_payday_day} />
        <section className="v-card v-stack" aria-labelledby="tx">
          <h2 id="tx">Tax and contributions</h2>
          <div className="v-row v-sp v-top"><div><b>Tables in use</b><div className="v-xs v-muted">Income tax: the 2023 TRAIN schedule. SSS: 5% of the monthly salary credit (SSS schedule effective January 2025, ₱250 to ₱1,750). Pag-IBIG: 2% of up to ₱10,000 (₱200 at most). PhilHealth: 2.5% of base, between ₱10,000 and ₱100,000. Type your own amount in the payslip builder to override any of them.</div></div><span className="v-pill v-ok">Applied to every year</span></div>
          <p className="v-xs v-muted" style={{ margin: 0 }}>Your own SSS, PhilHealth, Pag-IBIG or tax amounts go in the <Link href="/pay?tab=payslip">payslip builder</Link>.</p>
        </section>
        <NotificationsCard enabled={row.notif_capture_enabled} rules={rules} />
        <section className="v-card v-stack" aria-labelledby="cp">
          <div className="v-row v-sp"><h2 id="cp">Capture and duplicate rules</h2><Link className="v-btn v-sm" href="/rules">Open Rules</Link></div>
          <p className="v-xs v-muted" style={{ margin: 0 }}>What the app listens for, and what it does with it, now lives on the Rules page.</p>
        </section>
        <section className="v-card v-stack" aria-labelledby="lk">
          <h2 id="lk">Looks</h2>
          <div className="v-row v-wrap" style={{ gap: 8 }}><ThemeToggle className="v-btn v-sm" /><HideAmounts className="v-btn v-sm" withIcon /></div>
        </section>
        <section className="v-card v-stack" aria-labelledby="sw">
          <div className="v-row v-sp"><h2 id="sw">Setup wizard</h2><Link className="v-btn v-sm" href="/setup">Run again</Link></div>
          <p className="v-xs v-muted" style={{ margin: 0 }}>Running it again adds to what you have: new accounts and budget lines are added, and your starting salary and paydays are updated.</p>
        </section>
        <section className="v-card v-stack" aria-labelledby="dg">
          <div className="v-row v-sp"><h2 id="dg">Diagnostics</h2><Link className="v-btn v-sm" href="/settings/diagnostics">Open</Link></div>
          <p className="v-xs v-muted" style={{ margin: 0 }}>A temporary log from the phone app, for finding out why it sticks after idling.</p>
        </section>
        <section className="v-card v-stack" aria-labelledby="yd">
          <h2 id="yd">Your data</h2>
          <p className="v-xs v-muted" style={{ margin: 0 }}>Each file is a CSV of one table. Only your own rows are included.</p>
          <div className="v-row v-wrap" style={{ gap: 6 }}>{EXPORTS.map((n) => <a key={n} className="v-btn v-sm" href={`/export/${n}`}>{n.replace(/_/g, " ")}</a>)}</div>
          <form action={signOut}><button type="submit" className="v-btn v-sm">Sign out</button></form>
        </section>
      </div>
    </main>
  );
}
