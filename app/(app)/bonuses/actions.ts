"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthed } from "@/lib/auth/require";
import { validateLine } from "@/lib/budget/validate";
import { isPastPlan, isUuid } from "@/lib/plans/validate";
import { parseEventForm } from "@/lib/windfall/input";

function back(code?: string, err?: { message: string } | null): never {
  if (err) console.error("[bonuses] database error:", err.message);
  revalidatePath("/bonuses");
  const detail = err ? `&detail=${encodeURIComponent(err.message)}` : "";
  redirect(`/bonuses${code ? `?error=${code}${detail}` : ""}`);
}

export async function addEvent(formData: FormData) {
  const supabase = await requireAuthed();
  const { data: plan } = await supabase.from("plans").select("id,end_date").eq("is_active", true).maybeSingle();
  if (!plan) back("noplan");
  if (isPastPlan(plan.end_date)) back("past");
  const parsed = parseEventForm(Object.fromEntries(formData));
  if (!parsed.ok) back("invalid");
  const v = parsed.value;
  const { error } = await supabase.from("windfall_events").insert({
    plan_id: plan.id,
    kind: v.kind,
    name: v.name,
    cutoff: v.cutoff,
    pay_date: v.payDate,
    gross: v.gross,
    cip_eligible: v.cipEligible,
    cip_component_num: v.cipComponentNum,
    cip_multiplier_num: v.cipMultiplierNum,
  });
  back(error ? "failed" : undefined, error);
}

export async function deleteEvent(formData: FormData) {
  const supabase = await requireAuthed();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) back("failed");
  const { error } = await supabase.from("windfall_events").delete().eq("id", id);
  back(error ? "failed" : undefined, error);
}

export async function addAllocation(formData: FormData) {
  const supabase = await requireAuthed();
  const eventId = String(formData.get("eventId") ?? "");
  if (!isUuid(eventId)) back("failed");
  const parsed = validateLine({ name: formData.get("name"), amount: formData.get("amount") });
  if (!parsed.ok || parsed.value.amount <= 0) back("invalid-allocation");
  const { error } = await supabase.from("windfall_allocations").insert({ event_id: eventId, name: parsed.value.name, amount: parsed.value.amount });
  back(error ? "failed" : undefined, error);
}

// "Done" only records that the money was moved; it never changes what is left to allocate.
export async function toggleAllocation(formData: FormData) {
  const supabase = await requireAuthed();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) back("failed");
  const done = formData.get("done") !== "1";
  const { error } = await supabase.from("windfall_allocations").update({ done }).eq("id", id);
  back(error ? "failed" : undefined, error);
}

export async function deleteAllocation(formData: FormData) {
  const supabase = await requireAuthed();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) back("failed");
  const { error } = await supabase.from("windfall_allocations").delete().eq("id", id);
  back(error ? "failed" : undefined, error);
}
