import { money } from "@/lib/domain/money";
import type { PayslipLine } from "@/lib/engine/payslip";
import type { GroupView } from "./view";

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
 * feed savings. The savings plan goes in the category that feeds savings.
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

/**
 * The categories with their payslip deductions counted in: each total includes the rows listed under it, and each share is worked
 * against take-home before those deductions, so the Budget page shows your whole pay. What is left does not change, since the
 * same money is added to both sides. With a cutoff, only that cutoff's amounts count; pass that cutoff's take-home.
 */
export function withPayroll(
  groups: readonly GroupView[],
  rows: Readonly<Record<string, readonly PayrollRow[]>>,
  takeHome: number,
  cutoff: "first" | "second" | null = null,
): GroupView[] {
  const of = (r: PayrollRow) => (cutoff ? r[cutoff] : r.amount);
  const gross = takeHome + Object.values(rows).flat().reduce((t, r) => t + of(r), 0);
  return groups.map((g) => {
    const total = money(g.total + (rows[g.id] ?? []).reduce((t, r) => t + of(r), 0));
    return { ...g, total, share: gross > 0 ? Math.max(0, Math.min(100, (total / gross) * 100)) : 0 };
  });
}
