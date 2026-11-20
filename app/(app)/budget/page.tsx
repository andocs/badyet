import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { BUCKETS, type Cutoff } from "@/lib/budget/validate";
import { DEFAULT_SECOND_START, resolveCutoff } from "@/lib/dashboard/helpers";
import { bucketTotal, summarize, type Line } from "@/lib/budget/summary";
import { formatPesos, money, type Money } from "@/lib/domain/money";
import { computePay } from "@/lib/pay/compute";
import { formatRange } from "@/lib/plans/format";
import { isPastPlan, todayManila } from "@/lib/plans/validate";
import { createClient } from "@/lib/supabase/server";
import { WalletSelect } from "@/components/wallet-select";
import { addLine, deleteLine, updateLine } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Check the line: it needs a name and an amount like 1,234.50.",
  failed: "That did not save. Try again.",
  past: "This plan has ended, so its budget is read-only.",
};
const BUCKET_COLOR = { essentials: "var(--bucket-1)", wants: "var(--bucket-2)", savings: "var(--bucket-3)" } as const;
const peso = (m: Money) => formatPesos(m, { symbol: false });

export default async function BudgetPage({ searchParams }: PageProps<"/budget">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const detail = process.env.NODE_ENV !== "production" && typeof params.detail === "string" ? params.detail : undefined;

  const supabase = await createClient();
  const { data: settingsRow } = supabase ? await supabase.from("user_settings").select("second_cutoff_start_day").maybeSingle() : { data: null };
  const cutoff: Cutoff = resolveCutoff(params.cutoff, todayManila(), settingsRow?.second_cutoff_start_day ?? DEFAULT_SECOND_START);
  const { data: plan } = supabase
    ? await supabase.from("plans").select("id,name,start_date,end_date").eq("is_active", true).maybeSingle()
    : { data: null };
  const { data: pay } =
    plan && supabase ? await supabase.from("pay_profiles").select("*").eq("plan_id", plan.id).maybeSingle() : { data: null };
  const { data: rows } =
    plan && supabase
      ? await supabase.from("budget_lines").select("id,cutoff,bucket,name,amount,wallet_id").eq("plan_id", plan.id).order("created_at")
      : { data: null };

  if (!plan || !pay) {
    return (
      <main className="main">
        <div className="head"><div><h1>Budget</h1></div></div>
        <section className="card">
          <p className="sub" style={{ margin: 0 }}>
            {!plan ? "Budget belongs to a plan, and no plan is active yet." : "Set up your pay first, so there is a net amount to split."}
          </p>
          <p style={{ marginBottom: 0 }}>
            <Link href={!plan ? "/plans" : "/pay"} className="btn">{!plan ? "Go to Plans" : "Go to Pay"}</Link>
          </p>
        </section>
      </main>
    );
  }

  const { data: walletRows } = supabase ? await supabase.from("wallets").select("id,name").order("created_at") : { data: null };
  const wallets = walletRows ?? [];
  const past = isPastPlan(plan.end_date);
  const result = computePay({
    annualBase: money(pay.annual_base),
    allowanceSecond: money(pay.allowance_second),
    sss: money(pay.sss),
    pagibig: money(pay.pagibig),
    savingsPlanBp: pay.savings_plan_bp,
    philhealthOverride: pay.philhealth_override === null ? null : money(pay.philhealth_override),
    taxOverrideFirst: pay.tax_override_first === null ? null : money(pay.tax_override_first),
    taxOverrideSecond: pay.tax_override_second === null ? null : money(pay.tax_override_second),
  });
  const lines: Line[] = (rows ?? []).map((r) => ({ id: r.id, cutoff: r.cutoff, bucket: r.bucket, name: r.name, amount: money(r.amount) }));
  const rowWallet = new Map((rows ?? []).map((r) => [r.id, r.wallet_id as string | null]));
  const s = summarize(lines, result.first.netBeforePlan, result.second.netBeforePlan);
  const cur = cutoff === "first" ? s.first : s.second;
  const state = cur.left === 0 ? "ok" : cur.left < 0 ? "over" : "free";

  return (
    <main className="main">
      <div className="head">
        <div>
          <span className="lab">{plan.name} · {formatRange(plan.start_date, plan.end_date)}</span>
          <h1 style={{ marginTop: 6 }}>Budget</h1>
          <p className="sub">Give every peso of your net pay a job.</p>
        </div>
        <nav className="segmented" aria-label="Cutoff">
          <Link href="/budget?cutoff=first" aria-current={cutoff === "first" ? "page" : undefined}>1st cutoff</Link>
          <Link href="/budget?cutoff=second" aria-current={cutoff === "second" ? "page" : undefined}>2nd cutoff</Link>
        </nav>
      </div>
      {error && (
        <p className="notice err" role="alert" style={{ marginBottom: 18 }}>
          {error}
          {detail && <small style={{ display: "block", marginTop: 4, fontWeight: 500 }}>Technical detail: {detail}</small>}
        </p>
      )}

      <section className="card" aria-label="Left to budget" style={{ marginBottom: 18 }}>
        <div className={`budget-state ${state}`} role="status">
          <span>
            {state === "ok" && "Every peso has a job."}
            {state === "over" && `Over by ₱${peso(money(-cur.left))}. Trim a line below.`}
            {state === "free" && `₱${peso(cur.left)} has no job yet.`}
          </span>
          <span className="num">Left to budget: {cur.left < 0 ? "−" : ""}₱{peso(money(Math.abs(cur.left)))}</span>
        </div>
        <div className="split-bar" aria-hidden="true">
          {BUCKETS.map((b) => {
            const v = Math.max(0, bucketTotal(lines, cutoff, b.id));
            return <i key={b.id} style={{ flex: v, background: BUCKET_COLOR[b.id] }} />;
          })}
          {cur.left > 0 && <i style={{ flex: cur.left, background: "var(--soft)" }} />}
        </div>
        <p className="sub" style={{ margin: "8px 0 0" }}>
          Net pay to budget this cutoff: <b className="num">₱{peso(cur.net)}</b> · budgeted <b className="num">₱{peso(cur.total)}</b>
        </p>
      </section>

      <div className="split">
        <div className="stack">
          {BUCKETS.map((b) => {
            const mine = lines.filter((l) => l.cutoff === cutoff && l.bucket === b.id);
            return (
              <section key={b.id} className="card" aria-labelledby={`h-${b.id}`}>
                <div className="head" style={{ margin: "0 0 6px" }}>
                  <h2 id={`h-${b.id}`} style={{ margin: 0 }}>
                    <span className="dot" style={{ ["--c" as string]: BUCKET_COLOR[b.id] }} />
                    {b.label}
                  </h2>
                  <span className="num">₱{peso(bucketTotal(lines, cutoff, b.id))}</span>
                </div>
                {mine.length === 0 && <p className="sub" style={{ margin: "6px 0" }}>No lines yet.</p>}
                {mine.map((l) => (
                  <form key={l.id} action={updateLine} className="bline">
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="cutoff" value={cutoff} />
                    <input className="input" name="name" defaultValue={l.name} maxLength={60} aria-label={`Name of ${l.name}`} disabled={past} />
                    <input className="input num" name="amount" defaultValue={peso(l.amount)} inputMode="decimal" aria-label={`Amount for ${l.name}`} disabled={past} />
                    <WalletSelect wallets={wallets} value={rowWallet.get(l.id) ?? ""} disabled={past} label={`Wallet for ${l.name}`} />
                    {!past && (
                      <>
                        <button type="submit" className="btn sm ghost">Save</button>
                        <ConfirmButton message={`Delete ${l.name}? This cannot be undone.`} formAction={deleteLine} className="btn sm danger" aria-label={`Delete ${l.name}`}>Delete</ConfirmButton>
                      </>
                    )}
                  </form>
                ))}
                {!past && (
                  <form action={addLine} className="bline add">
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="cutoff" value={cutoff} />
                    <input type="hidden" name="bucket" value={b.id} />
                    <input className="input" name="name" placeholder={`New ${b.label.toLowerCase()} line`} maxLength={60} aria-label={`New ${b.label} line name`} required />
                    <input className="input num" name="amount" placeholder="0.00" inputMode="decimal" aria-label={`New ${b.label} line amount`} required />
                    <WalletSelect wallets={wallets} label={`Wallet for new ${b.label} line`} />
                    <button type="submit" className="btn sm">Add</button>
                  </form>
                )}
              </section>
            );
          })}
        </div>

        <section className="card" aria-labelledby="roll-h">
          <h2 id="roll-h">Month roll-up</h2>
          <table className="paytable">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Line</span></th>
                <th scope="col">1st</th>
                <th scope="col">2nd</th>
                <th scope="col">Month</th>
              </tr>
            </thead>
            <tbody>
              <tr><th scope="row">Net to budget</th><td className="num">{peso(s.first.net)}</td><td className="num">{peso(s.second.net)}</td><td className="num">{peso(s.month.net)}</td></tr>
              <tr><th scope="row">Budgeted</th><td className="num">{peso(s.first.total)}</td><td className="num">{peso(s.second.total)}</td><td className="num">{peso(s.month.total)}</td></tr>
              <tr className="strong"><th scope="row">Left to budget</th><td className="num">{peso(s.first.left)}</td><td className="num">{peso(s.second.left)}</td><td className="num">{peso(s.month.left)}</td></tr>
            </tbody>
          </table>
          <p className="sub">Net to budget comes from your Pay setup (after tax and contributions, before the payroll savings plan).</p>
        </section>
      </div>
    </main>
  );
}

