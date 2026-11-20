"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthed } from "@/lib/auth/require";
import { isCutoff } from "@/lib/budget/validate";
import { validateLine } from "@/lib/budget/validate";
import { isUuid } from "@/lib/plans/validate";
import { syncCommitments } from "@/lib/installments/sync";

function back(code?: string, err?: { message: string } | null): never {
  if (err) console.error("[subscriptions] database error:", err.message);
  revalidatePath("/subscriptions");
  const detail = err ? `&detail=${encodeURIComponent(err.message)}` : "";
  redirect(`/subscriptions${code ? `?error=${code}${detail}` : ""}`);
}

export async function addSubscription(formData: FormData) {
  const supabase = await requireAuthed();
  const parsed = validateLine({ name: formData.get("name"), amount: formData.get("amount") });
  const cutoff = formData.get("cutoff");
  const wallet = String(formData.get("walletId") ?? "");
  if (!parsed.ok || parsed.value.amount <= 0 || !isCutoff(cutoff) || (wallet !== "" && !isUuid(wallet))) back("invalid");
  const { error } = await supabase
    .from("subscriptions")
    .insert({ name: parsed.value.name, amount: parsed.value.amount, cutoff, wallet_id: wallet === "" ? null : wallet });
  if (!error) await syncCommitments(supabase);
  back(error ? "failed" : undefined, error);
}

export async function toggleSubscription(formData: FormData) {
  const supabase = await requireAuthed();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) back("failed");
  const next = formData.get("active") !== "1"; // the form carries the current state
  const { error } = await supabase.from("subscriptions").update({ active: next }).eq("id", id);
  if (!error) await syncCommitments(supabase);
  back(error ? "failed" : undefined, error);
}

export async function deleteSubscription(formData: FormData) {
  const supabase = await requireAuthed();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) back("failed");
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);
  if (!error) await syncCommitments(supabase);
  back(error ? "failed" : undefined, error);
}
