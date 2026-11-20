import type { GoalId, MonthResult } from "@/lib/domain/allocator";
import { money, sum, type Money } from "@/lib/domain/money";
import type { createClient } from "@/lib/supabase/server";
import { computeEvents } from "@/lib/windfall/compute";
import { runForecast } from "./forecast";
import { isGoal, type SavingsInput } from "./input";

type Db = NonNullable<Awaited<ReturnType<typeof createClient>>>;
interface SettingsRow {
  start_month: string;
  start_ef: number;
  start_travel: number;
  start_wants: number;
  ef_tranche: number;
  ef_hard_cap: number;
  travel_cap: number;
  wants_cap: number;
  priority: string;
}

export interface LoadedSavings {
  row: SettingsRow | null;
  overrides: Record<string, GoalId>;
  monthlyPool: Money;
  cipByMonth: Record<string, Money>;
  savings: SavingsInput | null;
  results: MonthResult[];
}

// Everything the Savings page and the dashboard need: settings, the monthly pool from the Savings
// budget lines, CIP net by month, and the allocator's 12-month projection.
export async function loadSavings(supabase: Db, planId: string): Promise<LoadedSavings> {
  const [{ data: row }, { data: overrideRows }, { data: lineRows }, { data: pay }, { data: cipRows }] = await Promise.all([
    supabase.from("savings_settings").select("*").eq("plan_id", planId).maybeSingle(),
    supabase.from("savings_overrides").select("month,goal").eq("plan_id", planId),
    supabase.from("budget_lines").select("amount").eq("plan_id", planId).eq("bucket", "savings"),
    supabase.from("pay_profiles").select("*").eq("plan_id", planId).maybeSingle(),
    supabase.from("windfall_events").select("*").eq("plan_id", planId).eq("kind", "cip"),
  ]);

  const monthlyPool = sum((lineRows ?? []).map((l) => money(l.amount)));
  const overrides: Record<string, GoalId> = {};
  for (const o of overrideRows ?? []) if (isGoal(o.goal)) overrides[o.month] = o.goal;

  // CIP net lands in the pool of the month it is paid (needs Pay set up for the estimate).
  const cipByMonth: Record<string, Money> = {};
  if (pay && cipRows && cipRows.length > 0) {
    const profile = {
      annualBase: money(pay.annual_base),
      allowanceSecond: money(pay.allowance_second),
      sss: money(pay.sss),
      pagibig: money(pay.pagibig),
      savingsPlanBp: pay.savings_plan_bp,
      philhealthOverride: pay.philhealth_override === null ? null : money(pay.philhealth_override),
      taxOverrideFirst: null,
      taxOverrideSecond: null,
    };
    const events = cipRows.map((e) => ({
      id: e.id as string,
      kind: "cip" as const,
      cutoff: e.cutoff as "first" | "second",
      payDate: e.pay_date as string,
      gross: e.gross === null ? null : money(e.gross),
      cipEligible: e.cip_eligible === null ? null : money(e.cip_eligible),
      cipComponentNum: e.cip_component_num as number | null,
      cipMultiplierNum: e.cip_multiplier_num as number | null,
    }));
    computeEvents(profile, events).forEach((r, i) => {
      const m = events[i].payDate.slice(0, 7);
      cipByMonth[m] = money((cipByMonth[m] ?? 0) + r.net);
    });
  }

  const savings: SavingsInput | null = row
    ? {
        startMonth: row.start_month,
        start: { ef: money(row.start_ef), travel: money(row.start_travel), wants: money(row.start_wants) },
        priority: row.priority,
        settings: {
          efTranche: money(row.ef_tranche),
          efHardCap: money(row.ef_hard_cap),
          travelCap: money(row.travel_cap),
          wantsCap: money(row.wants_cap),
          defaultOrder: String(row.priority).split(",") as GoalId[],
        },
      }
    : null;
  const results = savings ? runForecast({ savings, monthlyPool, cipByMonth, overrides }) : [];
  return { row, overrides, monthlyPool, cipByMonth, savings, results };
}
