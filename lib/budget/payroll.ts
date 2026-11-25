import type { PayslipLine } from "@/lib/engine/payslip";

/** One payslip deduction listed in a budget category: what it is, which cutoffs it comes off, and what it takes. */
export interface PayrollRow {
  label: string;
  /** The payroll savings plan, or one of your other payroll deductions. */
  kind: "plan" | "other";
  cutoff: "first" | "second" | "both";
  first: number;
  second: number;
  /** Over the month. */
  amount: number;
}

/**
 * Where each payslip deduction (your other deductions and the payroll savings plan) is listed on the Budget page. An other deduction
 * shows under the budget category it is set to; one with none, or whose category is gone, goes in the first category that does not
 * feed savings. The savings plan goes in the category that feeds savings. They are already out of take-home, so they are listed
 * in the category but never added to its total.
 */
export function payrollOnLines(
  pay: { first: { lines: readonly PayslipLine[] }; second: { lines: readonly PayslipLine[] } },
  groups: readonly { id: string; feedsSavings: boolean }[],
): Record<string, PayrollRow[]> {
  const out: Record<string, PayrollRow[]> = {};
  if (groups.length === 0) return out;
  const ids = new Set(groups.map((g) => g.id));
  const spending = groups.find((g) => !g.feedsSavings)?.id ?? groups[0]!.id;
  const saving = groups.find((g) => g.feedsSavings)?.id ?? groups[0]!.id;
  const add = (groupId: string, kind: PayrollRow["kind"], label: string, cutoff: "first" | "second", amount: number) => {
    const list = (out[groupId] ??= []);
    let row = list.find((r) => r.kind === kind && r.label === label);
    if (!row) list.push((row = { label, kind, cutoff, first: 0, second: 0, amount: 0 }));
    row[cutoff] += amount;
    row.amount += amount;
    row.cutoff = row.first > 0 && row.second > 0 ? "both" : row.first > 0 ? "first" : "second";
  };
  for (const cutoff of ["first", "second"] as const) {
    for (const l of pay[cutoff].lines) {
      if (l.source === "other_deduction") add(l.ref && ids.has(l.ref) ? l.ref : spending, "other", l.label, cutoff, l.amount);
      else if (l.source === "savings_plan") add(saving, "plan", l.label, cutoff, l.amount);
    }
  }
  return out;
}
