import Link from "next/link";
import { formatPesos, money, type Money } from "@/lib/domain/money";
import { computePay, type PayProfile } from "@/lib/pay/compute";
import { formatRange } from "@/lib/plans/format";
import { isPastPlan } from "@/lib/plans/validate";
import { createClient } from "@/lib/supabase/server";
import { savePay } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Check the numbers: amounts look like 1,234.50, and the savings plan is a percent from 0 to 100.",
  failed: "That did not save. Try again.",
  past: "This plan has ended, so its pay is read-only.",
};

const peso = (m: Money) => formatPesos(m, { symbol: false });
const field = (m: number | null | undefined) => (m === null || m === undefined ? "" : peso(money(m)));

export default async function PayPage({ searchParams }: PageProps<"/pay">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const supabase = await createClient();
  const { data: plan } = supabase
    ? await supabase.from("plans").select("id,name,start_date,end_date").eq("is_active", true).maybeSingle()
    : { data: null };
  const { data: row } =
    plan && supabase ? await supabase.from("pay_profiles").select("*").eq("plan_id", plan.id).maybeSingle() : { data: null };

  if (!plan) {
    return (
      <main className="main">
        <div className="head">
          <div>
            <h1>Pay</h1>
          </div>
        </div>
        <section className="card">
          <p className="sub" style={{ margin: 0 }}>Pay belongs to a plan, and no plan is active yet.</p>
          <p style={{ marginBottom: 0 }}>
            <Link href="/plans" className="btn">Go to Plans</Link>
          </p>
        </section>
      </main>
    );
  }

  const past = isPastPlan(plan.end_date);
  const profile: PayProfile | null = row
    ? {
        annualBase: money(row.annual_base),
        allowanceSecond: money(row.allowance_second),
        sss: money(row.sss),
        pagibig: money(row.pagibig),
        savingsPlanBp: row.savings_plan_bp,
        philhealthOverride: row.philhealth_override === null ? null : money(row.philhealth_override),
        taxOverrideFirst: row.tax_override_first === null ? null : money(row.tax_override_first),
        taxOverrideSecond: row.tax_override_second === null ? null : money(row.tax_override_second),
      }
    : null;
  const result = profile ? computePay(profile) : null;

  return (
    <main className="main">
      <div className="head">
        <div>
          <span className="lab">{plan.name} · {formatRange(plan.start_date, plan.end_date)}</span>
          <h1 style={{ marginTop: 6 }}>Pay</h1>
          <p className="sub">From your annual base to what lands in your account, cutoff by cutoff.</p>
        </div>
      </div>
      {error && <p className="notice err" role="alert" style={{ marginBottom: 18 }}>{error}</p>}
      {params.saved === "1" && <p className="notice ok" role="status" style={{ marginBottom: 18 }}>Saved.</p>}

      <div className="split">
        <section className="card" aria-labelledby="in-h">
          <h2 id="in-h">Your numbers</h2>
          <form action={savePay} className="form">
            <input type="hidden" name="planId" value={plan.id} />
            <label className="field"><span className="lab">Annual base salary</span><input className="input" name="annualBase" inputMode="decimal" required disabled={past} defaultValue={field(row?.annual_base)} placeholder="600,000.00" /></label>
            <label className="field"><span className="lab">Allowance, 2nd cutoff (not taxed)</span><input className="input" name="allowanceSecond" inputMode="decimal" disabled={past} defaultValue={field(row?.allowance_second)} placeholder="0.00" /></label>
            <label className="field"><span className="lab">SSS, 2nd cutoff</span><input className="input" name="sss" inputMode="decimal" disabled={past} defaultValue={field(row?.sss)} placeholder="0.00" /></label>
            <label className="field"><span className="lab">Pag-IBIG, 2nd cutoff</span><input className="input" name="pagibig" inputMode="decimal" disabled={past} defaultValue={field(row?.pagibig)} placeholder="0.00" /></label>
            <label className="field"><span className="lab">Savings plan, % of basic (not tax-affecting)</span><input className="input" name="savingsPlanPercent" inputMode="decimal" disabled={past} defaultValue={row ? String(row.savings_plan_bp / 100) : ""} placeholder="0" /></label>
            <p className="sub" style={{ margin: 0 }}>Overrides: leave blank to use the calculated value.</p>
            <label className="field"><span className="lab">PhilHealth override</span><input className="input" name="philhealthOverride" inputMode="decimal" disabled={past} defaultValue={field(row?.philhealth_override)} placeholder={result ? peso(result.philhealth) : "calculated"} /></label>
            <label className="field"><span className="lab">Tax override, 1st cutoff</span><input className="input" name="taxOverrideFirst" inputMode="decimal" disabled={past} defaultValue={field(row?.tax_override_first)} placeholder={result ? peso(result.first.tax) : "calculated"} /></label>
            <label className="field"><span className="lab">Tax override, 2nd cutoff</span><input className="input" name="taxOverrideSecond" inputMode="decimal" disabled={past} defaultValue={field(row?.tax_override_second)} placeholder={result ? peso(result.second.tax) : "calculated"} /></label>
            {past ? (
              <p className="sub" style={{ margin: 0 }}>This plan has ended, so pay is read-only.</p>
            ) : (
              <button type="submit" className="btn">Save pay</button>
            )}
          </form>
        </section>

        <section className="card" aria-labelledby="out-h">
          <h2 id="out-h">What you take home</h2>
          {!result || !profile ? (
            <p className="sub" style={{ margin: 0 }}>Enter your annual base to see the breakdown.</p>
          ) : (
            <>
              <table className="paytable">
                <thead>
                  <tr>
                    <th scope="col"><span className="sr-only">Line</span></th>
                    <th scope="col">1st cutoff</th>
                    <th scope="col">2nd cutoff</th>
                    <th scope="col">Month</th>
                  </tr>
                </thead>
                <tbody>
                  <PayRow label="Basic pay" a={result.first.taxable} b={result.second.taxable} c={result.month.taxable} />
                  <PayRow label="Allowance" a={result.first.nontaxable} b={result.second.nontaxable} c={result.month.nontaxable} />
                  <PayRow label="SSS, PhilHealth, Pag-IBIG" a={result.first.mandatory} b={result.second.mandatory} c={result.month.mandatory} minus />
                  <PayRow label={`Withholding tax${profile.taxOverrideFirst !== null || profile.taxOverrideSecond !== null ? " (override)" : ""}`} a={result.first.tax} b={result.second.tax} c={result.month.tax} minus />
                  <PayRow label="Net to budget" a={result.first.netBeforePlan} b={result.second.netBeforePlan} c={result.month.netBeforePlan} strong />
                  <PayRow label="Savings plan" a={result.first.plan} b={result.second.plan} c={result.month.plan} minus />
                  <PayRow label="Lands in your account" a={result.first.takeHome} b={result.second.takeHome} c={result.month.takeHome} strong />
                </tbody>
              </table>
              <p className="sub">
                PhilHealth {peso(result.philhealth)}
                {profile.philhealthOverride !== null ? " (override)" : " (5% of basic)"}. Basic per cutoff {peso(result.basicPerCutoff)}.
              </p>
              <p className="notice warn">
                The tax table (TRAIN, as of 2023) and the 5% PhilHealth rate are carried over from your old app and not re-checked
                against current rules. Use the override fields if your payslip differs.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function PayRow({ label, a, b, c, minus, strong }: { label: string; a: Money; b: Money; c: Money; minus?: boolean; strong?: boolean }) {
  const cell = (m: Money) => `${minus && m !== 0 ? "−" : ""}${peso(m)}`;
  return (
    <tr className={strong ? "strong" : undefined}>
      <th scope="row">{label}</th>
      <td className="num">{cell(a)}</td>
      <td className="num">{cell(b)}</td>
      <td className="num">{cell(c)}</td>
    </tr>
  );
}
