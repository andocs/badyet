import Link from "next/link";
import { Dashboard, type DashData } from "@/components/dashboard";
import { money } from "@/lib/domain/money";
import { DEFAULT_SECOND_START, currentCutoff, cutoffLabel, daysBetween } from "@/lib/dashboard/helpers";
import type { PayProfile } from "@/lib/pay/compute";
import { todayManila } from "@/lib/plans/validate";
import { loadSavings } from "@/lib/savings/load";
import { createClient } from "@/lib/supabase/server";
import { currentMonth } from "@/lib/transfer/month";
import { computeEvents } from "@/lib/windfall/compute";

const dateLabel = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${d}, ${y}`;
};

export default async function Home() {
  const supabase = await createClient();
  const { data: plan } = supabase
    ? await supabase.from("plans").select("id,name").eq("is_active", true).maybeSingle()
    : { data: null };

  if (!plan || !supabase) {
    return (
      <main className="main">
        <div className="head"><div><h1>Welcome to Bad(yet)</h1><p className="sub">Let us set up your first plan.</p></div></div>
        <section className="card">
          <p className="sub" style={{ margin: 0 }}>Your dashboard shows your money for the current payday, but it needs an active plan first.</p>
          <p style={{ marginBottom: 0 }}><Link href="/plans" className="btn">Create or activate a plan</Link></p>
        </section>
      </main>
    );
  }

  const today = todayManila();
  const month = currentMonth();
  const { data: settingsRow } = await supabase.from("user_settings").select("second_cutoff_start_day").maybeSingle();
  const secondStart: number = settingsRow?.second_cutoff_start_day ?? DEFAULT_SECOND_START;
  const cutoff = currentCutoff(today, secondStart);

  const [{ data: walletRows }, { data: lineRows }, { data: markRows }, { data: pay }, { data: bonusRows }, savings] = await Promise.all([
    supabase.from("wallets").select("id,name").order("created_at"),
    supabase.from("budget_lines").select("id,name,bucket,cutoff,amount,wallet_id").eq("plan_id", plan.id).order("created_at"),
    supabase.from("transfer_marks").select("line_id").eq("month", month),
    supabase.from("pay_profiles").select("*").eq("plan_id", plan.id).maybeSingle(),
    supabase.from("windfall_events").select("*").eq("plan_id", plan.id).eq("kind", "thirteenth").gte("pay_date", today).order("pay_date").limit(1),
    loadSavings(supabase, plan.id),
  ]);

  const all = lineRows ?? [];
  const mine = all.filter((l) => l.cutoff === cutoff);
  const bucketRow = (c: "first" | "second", label: string) => {
    const sumOf = (b: string) => all.filter((l) => l.cutoff === c && l.bucket === b).reduce((a, l) => a + Number(l.amount) / 100, 0);
    return { label, essentials: sumOf("essentials"), wants: sumOf("wants"), savings: sumOf("savings") };
  };

  // Emergency fund balance by month, in thousands of pesos, from the savings forecast.
  const forecast =
    savings.savings && savings.results.length > 0
      ? (() => {
          const cap = savings.savings.settings.efHardCap > 0 ? savings.savings.settings.efHardCap / 100_000 : null;
          const hit = cap === null ? undefined : savings.results.find((r) => r.balances.ef >= (savings.savings?.settings.efHardCap ?? 0));
          return {
            months: savings.results.map((r) => r.month as string),
            values: savings.results.map((r) => r.balances.ef / 100_000),
            cap,
            note: hit ? `Cap in ${hit.month}` : cap === null ? "No hard cap" : "Cap not reached in 12 months",
          };
        })()
      : null;

  let thirteenth: DashData["thirteenth"] = null;
  const next = bonusRows?.[0];
  if (next && pay) {
    const profile: PayProfile = {
      annualBase: money(pay.annual_base),
      allowanceSecond: money(pay.allowance_second),
      sss: money(pay.sss),
      pagibig: money(pay.pagibig),
      savingsPlanBp: pay.savings_plan_bp,
      philhealthOverride: pay.philhealth_override === null ? null : money(pay.philhealth_override),
      taxOverrideFirst: null,
      taxOverrideSecond: null,
    };
    const [result] = computeEvents(profile, [
      {
        id: next.id,
        kind: "thirteenth",
        cutoff: next.cutoff,
        payDate: next.pay_date,
        gross: next.gross === null ? null : money(next.gross),
        cipEligible: null,
        cipComponentNum: null,
        cipMultiplierNum: null,
      },
    ]);
    const { data: allocs } = await supabase.from("windfall_allocations").select("done").eq("event_id", next.id);
    thirteenth = {
      name: next.name,
      net: result.net,
      daysLeft: Math.max(0, daysBetween(today, next.pay_date)),
      dateLabel: dateLabel(next.pay_date),
      waiting: (allocs ?? []).filter((a) => !a.done).length,
    };
  }

  const data: DashData = {
    planName: plan.name,
    month,
    cutoff,
    cutoffLabel: cutoffLabel(month, cutoff, secondStart),
    wallets: walletRows ?? [],
    lines: mine.map((l) => ({ id: l.id, name: l.name, bucket: l.bucket, walletId: l.wallet_id, amount: Number(l.amount) })),
    sentIds: (markRows ?? []).map((r) => r.line_id as string),
    forecast,
    buckets: [bucketRow("first", "1st cutoff"), bucketRow("second", "2nd cutoff")],
    thirteenth,
  };

  // The key restarts the dashboard's local state whenever the saved ticks change on the server.
  return <Dashboard key={`${month}-${cutoff}-${data.sentIds.join(",")}-${data.lines.length}`} data={data} />;
}
