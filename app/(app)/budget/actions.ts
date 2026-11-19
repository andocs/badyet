"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthed } from "@/lib/auth/require";
import { isBucket, isCutoff, validateLine, type Cutoff } from "@/lib/budget/validate";
import { isPastPlan, isUuid } from "@/lib/plans/validate";

type Supabase = Awaited<ReturnType<typeof requireAuthed>>;

function back(cutoff: Cutoff, code?: string, err?: { message: string } | null): never {
  if (err) console.error("[budget] database error:", err.message);
  revalidatePath("/budget");
  const detail = err ? `&detail=${encodeURIComponent(err.message)}` : "";
  redirect(`/budget?cutoff=${cutoff}${code ? `&error=${code}` : ""}${detail}`);
}

function cutoffOf(formData: FormData): Cutoff {
  const c = formData.get("cutoff");
  return isCutoff(c) ? c : "first";
}

// A plan that has ended is read-only.
async function assertEditable(supabase: Supabase, planId: string, cutoff: Cutoff) {
  const { data: plan } = await supabase.from("plans").select("end_date").eq("id", planId).single();
  if (!plan) back(cutoff, "failed");
  if (isPastPlan(plan.end_date)) back(cutoff, "past");
}

export async function addLine(formData: FormData) {
  const supabase = await requireAuthed();
  const cutoff = cutoffOf(formData);
  const planId = String(formData.get("planId") ?? "");
  const bucket = formData.get("bucket");
  if (!isUuid(planId) || !isBucket(bucket)) back(cutoff, "failed");
  const parsed = validateLine({ name: formData.get("name"), amount: formData.get("amount") });
  if (!parsed.ok) back(cutoff, "invalid");
  await assertEditable(supabase, planId, cutoff);
  const { error } = await supabase
    .from("budget_lines")
    .insert({ plan_id: planId, cutoff, bucket, name: parsed.value.name, amount: parsed.value.amount });
  back(cutoff, error ? "failed" : undefined, error);
}

async function lineGuard(supabase: Supabase, formData: FormData, cutoff: Cutoff): Promise<string> {
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) back(cutoff, "failed");
  const { data: line } = await supabase.from("budget_lines").select("plan_id").eq("id", id).single();
  if (!line) back(cutoff, "failed");
  await assertEditable(supabase, line.plan_id, cutoff);
  return id;
}

export async function updateLine(formData: FormData) {
  const supabase = await requireAuthed();
  const cutoff = cutoffOf(formData);
  const id = await lineGuard(supabase, formData, cutoff);
  const parsed = validateLine({ name: formData.get("name"), amount: formData.get("amount") });
  if (!parsed.ok) back(cutoff, "invalid");
  const { error } = await supabase.from("budget_lines").update({ name: parsed.value.name, amount: parsed.value.amount }).eq("id", id);
  back(cutoff, error ? "failed" : undefined, error);
}

export async function deleteLine(formData: FormData) {
  const supabase = await requireAuthed();
  const cutoff = cutoffOf(formData);
  const id = await lineGuard(supabase, formData, cutoff);
  const { error } = await supabase.from("budget_lines").delete().eq("id", id);
  back(cutoff, error ? "failed" : undefined, error);
}
