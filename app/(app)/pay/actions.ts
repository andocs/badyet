"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthed } from "@/lib/auth/require";
import { parsePayForm } from "@/lib/pay/input";
import { isPastPlan, isUuid } from "@/lib/plans/validate";

// Stays on the plan being edited (a plan other than the active one can be edited too).
function payUrl(query: string, planId: string): string {
  return `/pay?${query}${isUuid(planId) ? `&plan=${planId}` : ""}`;
}

export async function savePay(formData: FormData) {
  const supabase = await requireAuthed();

  const planId = String(formData.get("planId") ?? "");
  if (!isUuid(planId)) redirect(payUrl("error=failed", planId));
  const { data: plan } = await supabase.from("plans").select("end_date").eq("id", planId).single();
  if (!plan) redirect(payUrl("error=failed", planId));
  if (isPastPlan(plan.end_date)) redirect(payUrl("error=past", planId));

  const parsed = parsePayForm(Object.fromEntries(formData));
  if (!parsed.ok) redirect(payUrl("error=invalid", planId));
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
      ...(v.otherDeduction && v.otherDeduction > 0 ? { other_deduction: v.otherDeduction } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "plan_id" },
  );
  revalidatePath("/pay");
  if (error) {
    console.error("[pay] database error:", error.message);
    redirect(payUrl(`error=failed&detail=${encodeURIComponent(error.message)}`, planId));
  }
  redirect(payUrl("saved=1", planId));
}
