"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthed } from "@/lib/auth/require";
import { isPastPlan, isUuid } from "@/lib/plans/validate";
import { isGoal, parseSavingsForm } from "@/lib/savings/input";
import { isMonth } from "@/lib/transfer/month";

function back(code?: string, err?: { message: string } | null): never {
  if (err) console.error("[savings] database error:", err.message);
  revalidatePath("/savings");
  const detail = err ? `&detail=${encodeURIComponent(err.message)}` : "";
  redirect(`/savings${code ? `?error=${code}${detail}` : "?saved=1"}`);
}

async function editablePlan(formData: FormData) {
  const supabase = await requireAuthed();
  const planId = String(formData.get("planId") ?? "");
  if (!isUuid(planId)) back("failed");
  const { data: plan } = await supabase.from("plans").select("end_date").eq("id", planId).single();
  if (!plan) back("failed");
  if (isPastPlan(plan.end_date)) back("past");
  return { supabase, planId };
}

export async function saveSettings(formData: FormData) {
  const { supabase, planId } = await editablePlan(formData);
  const parsed = parseSavingsForm(Object.fromEntries(formData));
  if (!parsed.ok) back("invalid");
  const v = parsed.value;
  const { error } = await supabase.from("savings_settings").upsert(
    {
      plan_id: planId,
      start_month: v.startMonth,
      start_ef: v.start.ef,
      start_travel: v.start.travel,
      start_wants: v.start.wants,
      ef_tranche: v.settings.efTranche,
      ef_hard_cap: v.settings.efHardCap,
      travel_cap: v.settings.travelCap,
      wants_cap: v.settings.wantsCap,
      priority: v.priority,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "plan_id" },
  );
  back(error ? "failed" : undefined, error);
}

// A blank goal clears the override for that month.
export async function setOverride(formData: FormData) {
  const { supabase, planId } = await editablePlan(formData);
  const month = formData.get("month");
  const goal = String(formData.get("goal") ?? "");
  if (!isMonth(month)) back("failed");
  const { error } =
    goal === ""
      ? await supabase.from("savings_overrides").delete().eq("plan_id", planId).eq("month", month)
      : isGoal(goal)
        ? await supabase.from("savings_overrides").upsert({ plan_id: planId, month, goal }, { onConflict: "plan_id,month" })
        : { error: { message: "unknown fund" } };
  back(error ? "failed" : undefined, error);
}
