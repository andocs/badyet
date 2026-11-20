import Link from "next/link";
import { AutoSync } from "@/components/auto-sync";
import { PlanBar } from "@/components/plan-bar";
import { pickPlan, planQuery } from "@/lib/plans/select";
import { Dashboard, type DashData } from "@/components/dashboard";
import { money } from "@/lib/domain/money";
import { DEFAULT_SECOND_START, currentCutoff, cutoffLabel, daysBetween, daysInMonthOf, resolveCutoff } from "@/lib/dashboard/helpers";
import type { PayProfile } from "@/lib/pay/compute";
import { todayManila } from "@/lib/plans/validate";
import { loadSavings } from "@/lib/savings/load";
import { createClient } from "@/lib/supabase/server";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/transfer/month";
import { computeEvents } from "@/lib/windfall/compute";
import { isKind } from "@/lib/accounts/input";
import { daysUntilDay, position } from "@/lib/accounts/summary";
import { paymentForMonth, rowFromDb } from "@/lib/installments/calc";
import { summarize } from "@/lib/budget/summary";
import { computePay } from "@/lib/pay/compute";

const dateLabel = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${d}, ${y}`;
};

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const supabase = await createClient();
  const plan = await pickPlan(supabase, params.plan);

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
  const cutoff = resolveCutoff(params.cutoff, today, secondStart);

  const [{ data: walletRows }, { data: lineRows }, { data: markRows }, { data: pay }, { data: bonusRows }, savings, { data: instRows }, { data: subRows }, { data: payRows }] = await Promise.all([
    supabase.from("wallets").select("id,name").order("created_at"),
    supabase.from("budget_lines").select("id,name,bucket,cutoff,amount,wallet_id").eq("plan_id", plan.id).order("created_at"),
    supabase.from("transfer_marks").select("line_id").eq("month", month),
    supabase.from("pay_profiles").select("*").eq("plan_id", plan.id).maybeSingle(),
    supabase.from("windfall_events").select("*").eq("plan_id", plan.id).eq("kind", "thirteenth").gte("pay_date", today).order("pay_date").limit(1),
    loadSavings(supabase, plan.id),
    supabase.from("installments").select("*"),
    supabase.from("subscriptions").select("name,amount,cutoff").eq("active", true),
    supabase.from("installment_payments").select("installment_id,seq"),
  ]);

  // Separate from the wallet list above: if the accounts migration is not applied yet, this just comes back empty and Now carries on.
  const { data: acctRows } = await supabase.from("wallets").select("name,kind,balance,credit_limit,due_day");
  const accts = (acctRows ?? []).map((a) => ({
    name: a.name as string,
    kind: isKind(a.kind) ? a.kind : ("ewallet" as const),
    balance: money(a.balance),
    creditLimit: a.credit_limit === null ? null : money(a.credit_limit),
    dueDay: a.due_day as number | null,
  }));
  const hasMoney = accts.some((a) => a.balance > 0);
  const pos = position(accts);
  const cardsDue = accts
    .filter((a) => a.kind === "credit" && a.balance > 0 && a.dueDay !== null)
    .map((a) => ({ name: a.name, owed: Number(a.balance), days: daysUntilDay(today, a.dueDay as number) }))
    .filter((c) => c.days <= 14)
    .sort((x, y) => x.days - y.days);

  const all = lineRows ?? [];
  const mine = all.filter((l) => l.cutoff === cutoff);

  // What this cutoff has, in pesos you can plan with: net pay, what is left once every line is placed.
  const payResult = pay
    ? computePay({
        annualBase: money(pay.annual_base),
        allowanceSecond: money(pay.allowance_second),
        sss: money(pay.sss),
        pagibig: money(pay.pagibig),
        savingsPlanBp: pay.savings_plan_bp,
        philhealthOverride: pay.philhealth_override === null ? null : money(pay.philhealth_override),
        taxOverrideFirst: pay.tax_override_first === null ? null : money(pay.tax_override_first),
        taxOverrideSecond: pay.tax_override_second === null ? null : money(pay.tax_override_second),
      })
    : null;
  const sums = payResult
    ? summarize(all.map((l) => ({ id: l.id, cutoff: l.cutoff, bucket: l.bucket, name: l.name, amount: money(l.amount) })), payResult.first.netBeforePlan, payResult.second.netBeforePlan)
    : null;
  const thisSum = sums ? (cutoff === "first" ? sums.first : sums.second) : null;
  const paidPairs = new Set((payRows ?? []).map((p) => `${p.installment_id}:${p.seq}`));
  const commitments = [
    ...(instRows ?? [])
      .map((r) => rowFromDb(r))
      .flatMap((r) => {
        const due = paymentForMonth(r, month);
        return r.cutoff === cutoff && due && due.amount > 0
          ? [{ name: r.name, amount: Number(due.amount), kind: "Installment", installmentId: r.id, seq: due.seq, paid: paidPairs.has(`${r.id}:${due.seq}`) }]
          : [];
      }),
    ...(subRows ?? []).filter((s) => s.cutoff === cutoff).map((s) => ({ name: s.name as string, amount: Number(s.amount), kind: "Subscription" })),
  ];
  // The next payday after today, and how many days of this cutoff are left to spend in.
  const nowCutoff = currentCutoff(today, secondStart);
  const nextStart = nowCutoff === "first" ? `${month}-${String(secondStart).padStart(2, "0")}` : `${shiftMonth(month, 1)}-01`;
  const nextMonthKey = nowCutoff === "first" ? month : shiftMonth(month, 1);
  const nextCutoff = nowCutoff === "first" ? "second" : "first";
  const todayDay = Number(today.slice(8, 10));
  const daysLeft = cutoff === "first" ? secondStart - todayDay : daysInMonthOf(month) - todayDay + 1;
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
    cutoffNet: thisSum ? Number(thisSum.net) : null,
    unplanned: thisSum ? Number(thisSum.left) : null,
    commitments,
    next: {
      days: Math.max(0, daysBetween(today, nextStart)),
      label: cutoffLabel(nextMonthKey, nextCutoff, secondStart).split(" · ")[0].toLowerCase() + " (" + monthLabel(nextMonthKey).split(" ")[0] + " " + Number(nextStart.slice(8, 10)) + ")",
      net: sums ? Number(nextCutoff === "first" ? sums.first.net : sums.second.net) : null,
    },
    daysLeft: Math.max(1, daysLeft),
    money: hasMoney ? { cash: Number(pos.cash), debt: Number(pos.debt), net: Number(pos.net), utilizationPct: pos.utilizationPct, cardsDue } : null,
  };

  // The key restarts the dashboard's local state whenever the saved ticks change on the server.
  return (
    <>
      <AutoSync />
      <div style={{ margin: "18px 22px 0" }}>
        <PlanBar basePath="/" plan={plan} keep={`cutoff=${cutoff}`} />
      </div>
      <nav className="segmented" aria-label="Cutoff" style={{ margin: "0 22px", width: "fit-content" }}>
        <Link href={`/?cutoff=first${planQuery(plan)}`} aria-current={cutoff === "first" ? "page" : undefined}>1st cutoff</Link>
        <Link href={`/?cutoff=second${planQuery(plan)}`} aria-current={cutoff === "second" ? "page" : undefined}>2nd cutoff</Link>
      </nav>
      <Dashboard key={`${month}-${cutoff}-${data.sentIds.join(",")}-${data.lines.length}`} data={data} />
    </>
  );
}
