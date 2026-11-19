"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthed } from "@/lib/auth/require";
import { parsePayForm } from "@/lib/pay/input";
import { isPastPlan, isUuid } from "@/lib/plans/validate";

export async function savePay(formData: FormData) {
  const supabase = await requireAuthed();

  const planId = String(formData.get("planId") ?? "");
  if (!isUuid(planId)) redirect("/pay?error=failed");
  const { data: plan } = await supabase.from("plans").select("end_date").eq("id", planId).single();
  if (!plan) redirect("/pay?error=failed");
  if (isPastPlan(plan.end_date)) redirect("/pay?error=past");

  const parsed = parsePayForm(Object.fromEntries(formData));
  if (!parsed.ok) redirect("/pay?error=invalid");
  const v = parsed.value;

  const { error } = await supabase.from("pay_profiles").upsert(
    {
      plan_id: planId,
      annual_base: v.annualBase,
      allowance_second: v.allowanceSecond,
      sss: v.sss,
      pagibig: v.pagibig,
      savings_plan_bp: v.savingsPlanBp,
      philhealth_override: v.philhealthOverride,
      tax_override_first: v.taxOverrideFirst,
      tax_override_second: v.taxOverrideSecond,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "plan_id" },
  );
  revalidatePath("/pay");
  if (error) {
    console.error("[pay] database error:", error.message);
    redirect(`/pay?error=failed&detail=${encodeURIComponent(error.message)}`);
  }
  redirect("/pay?saved=1");
}
