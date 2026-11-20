import { money, sum, type Money } from "@/lib/domain/money";
import { computePay } from "@/lib/pay/compute";
import { summarize, type Line } from "@/lib/budget/summary";
import { loadSavings } from "@/lib/savings/load";
import type { createClient } from "@/lib/supabase/server";

type Db = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export interface PlanMetrics {
  netFirst: Money;
  netSecond: Money;
  leftToBudget: Money; // both cutoffs together
  savingsPerMonth: Money;
  savingsAfter12: Money | null; // all funds together at the end of the forecast; null if no forecast is set up
}

// Difference b minus a, field by field. Missing forecast on either side gives null.
export function diffMetrics(a: PlanMetrics, b: PlanMetrics): Record<keyof PlanMetrics, Money | null> {
  return {
    netFirst: money(b.netFirst - a.netFirst),
    netSecond: money(b.netSecond - a.netSecond),
    leftToBudget: money(b.leftToBudget - a.leftToBudget),
    savingsPerMonth: money(b.savingsPerMonth - a.savingsPerMonth),
    savingsAfter12: a.savingsAfter12 === null || b.savingsAfter12 === null ? null : money(b.savingsAfter12 - a.savingsAfter12),
  };
}

// The same numbers the Pay, Budget and Savings pages show, for one plan. Null when the plan has no pay yet.
export async function loadPlanMetrics(supabase: Db, planId: string): Promise<PlanMetrics | null> {
  const { data: pay } = await supabase.from("pay_profiles").select("*").eq("plan_id", planId).maybeSingle();
  if (!pay) return null;
  const { data: rows } = await supabase.from("budget_lines").select("id,cutoff,bucket,name,amount").eq("plan_id", planId);
  const result = computePay({
    annualBase: money(pay.annual_base),
    allowanceSecond: money(pay.allowance_second),
    sss: money(pay.sss),
    pagibig: money(pay.pagibig),
    savingsPlanBp: pay.savings_plan_bp,
    philhealthOverride: pay.philhealth_override === null ? null : money(pay.philhealth_override),
    taxOverrideFirst: pay.tax_override_first === null ? null : money(pay.tax_override_first),
    taxOverrideSecond: pay.tax_override_second === null ? null : money(pay.tax_override_second),
    otherDeduction: money(pay.other_deduction ?? 0),
  });
  const lines: Line[] = (rows ?? []).map((r) => ({ id: r.id, cutoff: r.cutoff, bucket: r.bucket, name: r.name, amount: money(r.amount) }));
  const s = summarize(lines, result.first.netBeforePlan, result.second.netBeforePlan);
  const savings = await loadSavings(supabase, planId);
  const last = savings.results[savings.results.length - 1];
  return {
    netFirst: result.first.netBeforePlan,
    netSecond: result.second.netBeforePlan,
    leftToBudget: sum([s.first.left, s.second.left]),
    savingsPerMonth: savings.monthlyPool,
    savingsAfter12: last ? sum([last.balances.ef, last.balances.travel, last.balances.wants].map((m) => money(m))) : null,
  };
}
