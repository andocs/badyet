import { isCutoff, type Cutoff } from "@/lib/budget/validate";
import { money, sum } from "@/lib/domain/money";
import { isPastPlan } from "@/lib/plans/validate";
import type { createClient } from "@/lib/supabase/server";
import { currentMonth } from "@/lib/transfer/month";
import { dueByCutoff, rowFromDb } from "./calc";

type Db = NonNullable<Awaited<ReturnType<typeof createClient>>>;
export type SyncResult = "ok" | "noplan" | "past" | "failed";

// Keeps one Essentials budget line per cutoff for installments and one for subscriptions, equal to what is due this month.
// Other budget lines are never touched (they have no `source`). Safe to run any time: it only writes what differs.
export async function syncCommitments(supabase: Db): Promise<SyncResult> {
  const { data: plan } = await supabase.from("plans").select("id,end_date").eq("is_active", true).maybeSingle();
  if (!plan) return "noplan";
  if (isPastPlan(plan.end_date)) return "past";

  const month = currentMonth();
  const { data: instRows } = await supabase.from("installments").select("*");
  const { data: subRows } = await supabase.from("subscriptions").select("cutoff,amount").eq("active", true);
  const inst = dueByCutoff((instRows ?? []).map((r) => rowFromDb(r)), month);
  const subTotal = (c: Cutoff) => sum((subRows ?? []).filter((s) => isCutoff(s.cutoff) && s.cutoff === c).map((s) => money(s.amount)));

  const targets = (["first", "second"] as const).flatMap((cutoff) => [
    { cutoff, source: "installments" as const, name: "Installments", amount: inst[cutoff] },
    { cutoff, source: "subscriptions" as const, name: "Subscriptions", amount: subTotal(cutoff) },
  ]);

  for (const t of targets) {
    const { data: existing } = await supabase
      .from("budget_lines")
      .select("id,amount")
      .eq("plan_id", plan.id)
      .eq("cutoff", t.cutoff)
      .eq("source", t.source)
      .maybeSingle();
    let error: { message: string } | null = null;
    if (existing && t.amount > 0) {
      if (Number(existing.amount) !== Number(t.amount)) ({ error } = await supabase.from("budget_lines").update({ amount: t.amount }).eq("id", existing.id));
    } else if (existing) ({ error } = await supabase.from("budget_lines").delete().eq("id", existing.id));
    else if (t.amount > 0) {
      ({ error } = await supabase
        .from("budget_lines")
        .insert({ plan_id: plan.id, cutoff: t.cutoff, bucket: "essentials", name: t.name, amount: t.amount, source: t.source }));
    }
    if (error) {
      console.error("[sync] budget line:", error.message);
      return "failed";
    }
  }
  return "ok";
}
