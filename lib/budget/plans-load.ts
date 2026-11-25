import type { SupabaseClient } from "@supabase/supabase-js";
import { plansFromRows, type PlanSpan } from "./plans";

/**
 * Budget plans and which plan each line belongs to. Asked for on their own, so a database without the rev-37 update still loads
 * (no plans, every line in the normal budget).
 */
export async function loadPlans(supabase: SupabaseClient): Promise<{ plans: PlanSpan[]; planOf: Map<string, string | null> }> {
  const [planRes, linkRes] = await Promise.all([
    supabase.from("budget_plans").select("id, name, start_month, start_cutoff, end_month, end_cutoff"),
    supabase.from("budget_lines_v2").select("id, plan_id"),
  ]);
  if (planRes.error || linkRes.error) return { plans: [], planOf: new Map() };
  return {
    plans: plansFromRows((planRes.data ?? []) as Parameters<typeof plansFromRows>[0]),
    planOf: new Map(((linkRes.data ?? []) as { id: string; plan_id: string | null }[]).map((r) => [r.id, r.plan_id])),
  };
}
