import type { PayslipLine } from "@/lib/engine/payslip";

/** One payslip deduction shown on a budget line: what it is called and what it takes in the month. */
export interface PayrollOnLine {
  label: string;
  amount: number;
}

/**
 * Splits what the payslip takes (other deductions and the payroll savings plan) for the Budget page. An other deduction that is set to
 * show under a budget line goes in `byLine`; it is already out of take-home, so it is shown on that line but never added to its amount.
 * Everything else (no line chosen, a line that no longer exists, the savings plan) stays in `loose`.
 */
export function payrollOnLines(
  pay: { first: { lines: readonly PayslipLine[] }; second: { lines: readonly PayslipLine[] } },
  lineIds: ReadonlySet<string>,
): { byLine: Record<string, PayrollOnLine[]>; loose: PayslipLine[] } {
  const byLine: Record<string, PayrollOnLine[]> = {};
  const loose: PayslipLine[] = [];
  for (const l of [...pay.first.lines, ...pay.second.lines]) {
    if (l.source === "other_deduction" && l.ref && lineIds.has(l.ref)) {
      const list = (byLine[l.ref] ??= []);
      const found = list.find((x) => x.label === l.label);
      if (found) found.amount += l.amount;
      else list.push({ label: l.label, amount: l.amount });
    } else if (l.source === "other_deduction" || l.source === "savings_plan") loose.push(l);
  }
  return { byLine, loose };
}
