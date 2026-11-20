"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthed } from "@/lib/auth/require";
import { isBucket, isCutoff, validateLine, type Cutoff } from "@/lib/budget/validate";
import { isPastPlan, isUuid } from "@/lib/plans/validate";

// A blank wallet means "no wallet yet"; anything else must be a real id (RLS scopes it to the user).
function walletOf(formData: FormData): string | null | undefined {
  const w = String(formData.get("walletId") ?? "");
  if (w === "") return null;
  return isUuid(w) ? w : undefined;
}

type Supabase = Awaited<ReturnType<typeof requireAuthed>>;

// Back to Budget on the same cutoff, and on the same plan when a non-active plan is being edited (hidden "plan" field).
function back(cutoff: Cutoff, code?: string, err?: { message: string } | null, formData?: FormData): never {
  if (err) console.error("[budget] database error:", err.message);
  revalidatePath("/budget");
  const detail = err ? `&detail=${encodeURIComponent(err.message)}` : "";
  const viewing = String(formData?.get("plan") ?? "");
  const plan = isUuid(viewing) ? `&plan=${viewing}` : "";
  redirect(`/budget?cutoff=${cutoff}${plan}${code ? `&error=${code}` : ""}${detail}`);
}

function cutoffOf(formData: FormData): Cutoff {
  const c = formData.get("cutoff");
  return isCutoff(c) ? c : "first";
}

// A plan that has ended is read-only.
async function assertEditable(supabase: Supabase, planId: string, cutoff: Cutoff, formData: FormData) {
  const { data: plan } = await supabase.from("plans").select("end_date").eq("id", planId).single();
  if (!plan) back(cutoff, "failed", null, formData);
  if (isPastPlan(plan.end_date)) back(cutoff, "past", null, formData);
}

export async function addLine(formData: FormData) {
  const supabase = await requireAuthed();
  const cutoff = cutoffOf(formData);
  const planId = String(formData.get("planId") ?? "");
  const bucket = formData.get("bucket");
  const walletId = walletOf(formData);
  if (!isUuid(planId) || !isBucket(bucket) || walletId === undefined) back(cutoff, "failed", null, formData);
  const parsed = validateLine({ name: formData.get("name"), amount: formData.get("amount") });
  if (!parsed.ok) back(cutoff, "invalid", null, formData);
  await assertEditable(supabase, planId, cutoff, formData);
  const { error } = await supabase
    .from("budget_lines")
    .insert({ plan_id: planId, cutoff, bucket, name: parsed.value.name, amount: parsed.value.amount, wallet_id: walletId });
  back(cutoff, error ? "failed" : undefined, error, formData);
}

async function lineGuard(supabase: Supabase, formData: FormData, cutoff: Cutoff): Promise<string> {
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) back(cutoff, "failed", null, formData);
  const { data: line } = await supabase.from("budget_lines").select("plan_id").eq("id", id).single();
  if (!line) back(cutoff, "failed", null, formData);
  await assertEditable(supabase, line.plan_id, cutoff, formData);
  return id;
}

export async function updateLine(formData: FormData) {
  const supabase = await requireAuthed();
  const cutoff = cutoffOf(formData);
  const id = await lineGuard(supabase, formData, cutoff);
  const walletId = walletOf(formData);
  if (walletId === undefined) back(cutoff, "failed", null, formData);
  const parsed = validateLine({ name: formData.get("name"), amount: formData.get("amount") });
  if (!parsed.ok) back(cutoff, "invalid", null, formData);
  const { error } = await supabase
    .from("budget_lines")
    .update({ name: parsed.value.name, amount: parsed.value.amount, wallet_id: walletId })
    .eq("id", id);
  back(cutoff, error ? "failed" : undefined, error, formData);
}

export async function deleteLine(formData: FormData) {
  const supabase = await requireAuthed();
  const cutoff = cutoffOf(formData);
  const id = await lineGuard(supabase, formData, cutoff);
  const { error } = await supabase.from("budget_lines").delete().eq("id", id);
  back(cutoff, error ? "failed" : undefined, error, formData);
}

export type SaveLineResult = { ok: true; name: string; amount: number; walletId: string | null } | { ok: false; error: string };

// Autosave from a tapped-open row (called from the browser, not a form). Lines that come from Installments or
// Subscriptions are kept in step automatically, so they cannot be edited here.
export async function saveLineInline(id: string, name: string, amount: string, walletId: string): Promise<SaveLineResult> {
  const supabase = await requireAuthed();
  if (!isUuid(id)) return { ok: false, error: "That line could not be found." };
  const wallet = walletId === "" ? null : isUuid(walletId) ? walletId : undefined;
  if (wallet === undefined) return { ok: false, error: "Pick a wallet from the list." };
  const parsed = validateLine({ name, amount });
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { data: line } = await supabase.from("budget_lines").select("plan_id,source").eq("id", id).maybeSingle();
  if (!line) return { ok: false, error: "That line could not be found." };
  if (line.source) return { ok: false, error: "This line follows your installments and subscriptions automatically." };
  const { data: plan } = await supabase.from("plans").select("end_date").eq("id", line.plan_id).maybeSingle();
  if (!plan || isPastPlan(plan.end_date)) return { ok: false, error: "This plan has ended, so its budget is read-only." };
  const { error } = await supabase.from("budget_lines").update({ name: parsed.value.name, amount: parsed.value.amount, wallet_id: wallet }).eq("id", id);
  if (error) {
    console.error("[budget] saveLineInline:", error.message);
    return { ok: false, error: "That did not save. Try again." };
  }
  revalidatePath("/budget");
  return { ok: true, name: parsed.value.name, amount: Number(parsed.value.amount), walletId: wallet };
}
