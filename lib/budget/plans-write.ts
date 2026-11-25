import type { SupabaseClient } from "@supabase/supabase-js";
import { plansFromRows, validatePlan } from "./plans";

export type PlanResult = { ok: true; id?: string } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINE_COLS =
  "id, category_id, name, rule, amount, pct_bp, amount_second, reimburse_amount, reimburse_cutoff, reimburse_day, cutoff, account_id, starts_on, ends_on, is_draft, sort, counts_to_daily, kind, source";

type PlanInput = { id?: string | null; name: unknown; from: { month: unknown; cutoff: unknown }; to: { month: unknown; cutoff: unknown } };

async function otherPlans(supabase: SupabaseClient) {
  const r = await supabase.from("budget_plans").select("id, name, start_month, start_cutoff, end_month, end_cutoff");
  if (r.error) return null;
  return plansFromRows((r.data ?? []) as Parameters<typeof plansFromRows>[0]);
}

const row = (v: { name: string; from: { month: string; cutoff: string }; to: { month: string; cutoff: string } }) => ({
  name: v.name, start_month: `${v.from.month}-01`, start_cutoff: v.from.cutoff, end_month: `${v.to.month}-01`, end_cutoff: v.to.cutoff,
});

/**
 * A new plan, started as a copy of the normal budget: every line (and the raise top-ups on it) is copied into the plan, ready to
 * be changed. If the copy fails the plan is removed again, so there is never a half-made plan.
 */
export async function createPlan(supabase: SupabaseClient, input: PlanInput): Promise<PlanResult> {
  const others = await otherPlans(supabase);
  if (!others) return { error: "Apply the budget plans database update first." };
  const v = validatePlan({ ...input, id: null }, others);
  if (!v.ok) return { error: v.error };

  const plan = await supabase.from("budget_plans").insert(row(v.value)).select("id").single();
  if (plan.error || !plan.data) return { error: "Could not save the plan. Try again." };
  const planId = plan.data.id as string;

  const base = await supabase.from("budget_lines_v2").select(LINE_COLS).is("plan_id", null);
  const fail = async () => {
    await supabase.from("budget_plans").delete().eq("id", planId);
    return { error: "Could not copy your budget into the plan. Try again." } as const;
  };
  if (base.error) return fail();
  const lines = (base.data ?? []) as ({ id: string } & Record<string, unknown>)[];
  if (lines.length > 0) {
    // Same columns, a new id (the database makes one), in the plan.
    const copies = lines.map((l) => { const copy: Record<string, unknown> = { ...l, plan_id: planId }; delete copy.id; return copy; });
    const ins = await supabase.from("budget_lines_v2").insert(copies).select("id");
    if (ins.error || !ins.data || ins.data.length !== lines.length) return fail();
    // Inserted rows come back in the order sent, so copy i is the copy of line i.
    const newId = new Map(lines.map((l, i) => [l.id, (ins.data![i] as { id: string }).id]));
    const alloc = await supabase.from("raise_allocations").select("salary_event_id, budget_line_id, mode, amount, pct_bp").in("budget_line_id", lines.map((l) => l.id));
    const tops = ((alloc.data ?? []) as { budget_line_id: string }[]).map((a) => ({ ...a, budget_line_id: newId.get(a.budget_line_id)! }));
    if (tops.length > 0) {
      const t = await supabase.from("raise_allocations").insert(tops);
      if (t.error) return fail();
    }
  }
  return { ok: true, id: planId };
}

/** Renames a plan or moves its dates (still no overlaps). Its lines stay as they are. */
export async function updatePlan(supabase: SupabaseClient, input: PlanInput & { id: string }): Promise<PlanResult> {
  if (!UUID.test(input.id)) return { error: "That plan was not found." };
  const others = await otherPlans(supabase);
  if (!others) return { error: "Apply the budget plans database update first." };
  if (!others.some((p) => p.id === input.id)) return { error: "That plan was not found." };
  const v = validatePlan(input, others);
  if (!v.ok) return { error: v.error };
  const r = await supabase.from("budget_plans").update(row(v.value)).eq("id", input.id);
  return r.error ? { error: "Could not save the plan. Try again." } : { ok: true, id: input.id };
}

/** Deletes a plan and its lines; the normal budget applies to those cutoffs again. Spending linked to its lines stays. */
export async function deletePlan(supabase: SupabaseClient, id: string): Promise<PlanResult> {
  if (!UUID.test(id)) return { error: "That plan was not found." };
  const r = await supabase.from("budget_plans").delete().eq("id", id);
  return r.error ? { error: "Could not delete the plan. Try again." } : { ok: true };
}

/** The plan a new line goes into, from the editor's input (null = the normal budget). */
export function planIdOf(input: unknown): string | null {
  const v = (input as { planId?: unknown } | null)?.planId;
  return typeof v === "string" && UUID.test(v) ? v : null;
}
