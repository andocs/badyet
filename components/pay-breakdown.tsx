import { formatPesos, type Money } from "@/lib/domain/money";
import { computePay, type PayProfile } from "@/lib/pay/compute";

const peso = (m: Money) => formatPesos(m, { symbol: false });

// The cutoff-by-cutoff pay table plus the "unverified rules" notice. Pure: safe in server or client.
export function PayBreakdown({ profile }: { profile: PayProfile }) {
  const r = computePay(profile);
  const taxOverridden = profile.taxOverrideFirst !== null || profile.taxOverrideSecond !== null;
  return (
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
          <Row label="Basic pay" a={r.first.taxable} b={r.second.taxable} c={r.month.taxable} />
          <Row label="Allowance" a={r.first.nontaxable} b={r.second.nontaxable} c={r.month.nontaxable} />
          <Row label="SSS, PhilHealth, Pag-IBIG" a={r.first.mandatory} b={r.second.mandatory} c={r.month.mandatory} minus />
          <Row label={`Withholding tax${taxOverridden ? " (override)" : ""}`} a={r.first.tax} b={r.second.tax} c={r.month.tax} minus />
          <Row label="Net to budget" a={r.first.netBeforePlan} b={r.second.netBeforePlan} c={r.month.netBeforePlan} strong />
          <Row label="Savings plan" a={r.first.plan} b={r.second.plan} c={r.month.plan} minus />
          <Row label="Lands in your account" a={r.first.takeHome} b={r.second.takeHome} c={r.month.takeHome} strong />
        </tbody>
      </table>
      <p className="sub">
        PhilHealth {peso(r.philhealth)}
        {profile.philhealthOverride !== null ? " (override)" : " (2.5% of monthly basic)"}. Basic per cutoff {peso(r.basicPerCutoff)}.
      </p>
      <p className="notice warn">
        Tax uses the TRAIN table in force since 2023, and PhilHealth is 2.5% of monthly basic (10,000 to 100,000 range). Both were checked
        against published 2026 guides in Nov 2026, not against official circulars. SSS and Pag-IBIG are what you typed. If your payslip
        differs, use the override fields.
      </p>
    </>
  );
}

function Row({ label, a, b, c, minus, strong }: { label: string; a: Money; b: Money; c: Money; minus?: boolean; strong?: boolean }) {
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
