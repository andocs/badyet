import type { PayslipLine } from "@/lib/engine/payslip";

/** One payslip deduction shown under a budget category: what it is called and what it takes in the month. */
export interface PayrollOnLine {
  label: string;
  amount: number;
}

/**
 * Splits what the payslip takes (other deductions and the payroll savings plan) for the Budget page. An other deduction that is set to
 * show under a budget category (Essentials, Savings, Wants...) goes in `byGroup`; it is already out of take-home, so it is listed in
 * that category but never added to its total. Everything else (no category chosen, one that no longer exists, the savings plan)
 * stays in `loose`.
 */
export function payrollOnLines(
  pay: { first: { lines: readonly PayslipLine[] }; second: { lines: readonly PayslipLine[] } },
  groupIds: ReadonlySet<string>,
): { byGroup: Record<string, PayrollOnLine[]>; loose: PayslipLine[] } {
  const byGroup: Record<string, PayrollOnLine[]> = {};
  const loose: PayslipLine[] = [];
  for (const l of [...pay.first.lines, ...pay.second.lines]) {
    if (l.source === "other_deduction" && l.ref && groupIds.has(l.ref)) {
      const list = (byGroup[l.ref] ??= []);
      const found = list.find((x) => x.label === l.label);
      if (found) found.amount += l.amount;
      else list.push({ label: l.label, amount: l.amount });
    } else if (l.source === "other_deduction" || l.source === "savings_plan") loose.push(l);
  }
  return { byGroup, loose };
}
