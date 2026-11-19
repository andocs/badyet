"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthed } from "@/lib/auth/require";
import { isPastPlan, isUuid, validatePlan } from "@/lib/plans/validate";

// `err` is the database error, if any: logged on the server and shown (dev only) on the page.
function back(code?: string, err?: { message: string } | null): never {
  if (err) console.error("[plans] database error:", err.message);
  revalidatePath("/plans");
  const detail = err ? `&detail=${encodeURIComponent(err.message)}` : "";
  redirect(code ? `/plans?error=${code}${detail}` : "/plans");
}

function idOf(formData: FormData): string {
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) back("failed");
  return id;
}

function planFields(formData: FormData) {
  return validatePlan({ name: formData.get("name"), startDate: formData.get("startDate"), endDate: formData.get("endDate") });
}

export async function createPlan(formData: FormData) {
  const supabase = await requireAuthed();
  const parsed = planFields(formData);
  if (!parsed.ok) back("invalid");
  const { name, startDate, endDate } = parsed.value;
  const { error } = await supabase.from("plans").insert({ name, start_date: startDate, end_date: endDate });
  back(error ? "failed" : undefined, error);
}

export async function updatePlan(formData: FormData) {
  const supabase = await requireAuthed();
  const id = idOf(formData);
  const parsed = planFields(formData);
  if (!parsed.ok) redirect(`/plans/${id}?error=invalid`);
  const { data: existing } = await supabase.from("plans").select("end_date").eq("id", id).single();
  if (!existing) back("failed");
  if (isPastPlan(existing.end_date)) back("past");
  const { name, startDate, endDate } = parsed.value;
  const { error } = await supabase.from("plans").update({ name, start_date: startDate, end_date: endDate }).eq("id", id);
  back(error ? "failed" : undefined, error);
}

export async function duplicatePlan(formData: FormData) {
  const supabase = await requireAuthed();
  const id = idOf(formData);
  const { data: src } = await supabase.from("plans").select("name,start_date,end_date").eq("id", id).single();
  if (!src) back("failed");
  const name = `${src.name} (copy)`.slice(0, 60);
  const { error } = await supabase.from("plans").insert({ name, start_date: src.start_date, end_date: src.end_date });
  back(error ? "failed" : undefined, error);
}

export async function activatePlan(formData: FormData) {
  const supabase = await requireAuthed();
  const id = idOf(formData);
  const { data: plan } = await supabase.from("plans").select("end_date").eq("id", id).single();
  if (!plan) back("failed");
  if (isPastPlan(plan.end_date)) back("past");
  const { error } = await supabase.rpc("activate_plan", { p_id: id });
  back(error ? "failed" : undefined, error);
}

export async function deletePlan(formData: FormData) {
  const supabase = await requireAuthed();
  const id = idOf(formData);
  const { data: plan } = await supabase.from("plans").select("is_active").eq("id", id).single();
  if (!plan) back("failed");
  if (plan.is_active) back("active");
  const { error } = await supabase.from("plans").delete().eq("id", id);
  back(error ? "failed" : undefined, error);
}
