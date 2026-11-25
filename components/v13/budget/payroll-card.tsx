import { payrollOnLines } from "@/lib/budget/payroll";
import { money } from "@/lib/domain/money";
import type { MonthPay } from "@/lib/engine/payslip";
import { Money } from "../money";

/**
 * What your employer takes from each payslip apart from the necessary deductions (an HMO plan, the payroll savings plan). It is already
 * out of your take-home, so it is listed here for the whole picture but is not part of the planned total.
 */
export function PayrollDeductionsCard({ pay, groupIds }: { pay: MonthPay; groupIds: ReadonlySet<string> }) {
  // An other deduction set to show under a budget line is shown on that line instead, so only the rest is listed here.
  const lines = payrollOnLines(pay, groupIds).loose;
  if (lines.length === 0) return null;
  // Each shows once per cutoff on the payslip; list each by name with what it comes to each cutoff and in the month.
  const byName = new Map<string, number[]>();
  for (const l of lines) byName.set(l.label, [...(byName.get(l.label) ?? []), l.amount]);
  return (
    <section className="v-card v-stack" aria-labelledby="pd-h" style={{ gap: 8 }}>
      <h2 id="pd-h">From your payslip</h2>
      <div className="v-xs v-muted">Taken before your take-home, so they are not part of the planned total below.</div>
      {[...byName.entries()].map(([name, amounts]) => (
        <div key={name} className="v-row v-sp">
          <span>{name}</span>
          <span className="v-num"><Money value={money(Math.max(...amounts))} /> a cutoff · <Money value={money(amounts.reduce((a, b) => a + b, 0))} /> a month</span>
        </div>
      ))}
    </section>
  );
}
