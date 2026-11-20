"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthed } from "@/lib/auth/require";
import { syncCommitments } from "@/lib/installments/sync";
import { parseInstalmentForm } from "@/lib/installments/input";
import { isUuid } from "@/lib/plans/validate";

function back(page: "installments" | "subscriptions", code?: string, err?: { message: string } | null): never {
  if (err) console.error(`[${page}] database error:`, err.message);
  revalidatePath(`/${page}`);
  revalidatePath("/budget");
  const detail = err ? `&detail=${encodeURIComponent(err.message)}` : "";
  redirect(`/${page}${code ? `?error=${code}${detail}` : ""}`);
}

export async function addInstalment(formData: FormData) {
  const supabase = await requireAuthed();
  const parsed = parseInstalmentForm(Object.fromEntries(formData));
  if (!parsed.ok) back("installments", "invalid");
  const v = parsed.value;
  const { data: created, error } = await supabase
    .from("installments")
    .insert({
      name: v.name,
      price: v.price,
      down_payment: v.downPayment,
      term_count: v.termCount,
      rate_bp: v.rateBp,
      first_due_on: v.firstDueOn,
      cutoff: v.cutoff,
      wallet_id: v.walletId,
    })
    .select("id")
    .single();
  if (error || !created) back("installments", "failed", error);
  if (v.paidCount > 0) {
    const paid = Array.from({ length: v.paidCount }, (_, i) => ({ installment_id: created.id, seq: i + 1 }));
    const { error: payError } = await supabase.from("installment_payments").insert(paid);
    if (payError) back("installments", "failed", payError);
  }
  await syncCommitments(supabase);
  back("installments");
}

// Marks the next unpaid payment as paid, or (undo=1) un-marks the last paid one.
export async function setNextPayment(formData: FormData) {
  const supabase = await requireAuthed();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) back("installments", "failed");
  const { data: inst } = await supabase.from("installments").select("term_count").eq("id", id).maybeSingle();
  if (!inst) back("installments", "failed");
  const { data: rows, error: readError } = await supabase.from("installment_payments").select("seq").eq("installment_id", id);
  if (readError) back("installments", "failed", readError);
  const paid = new Set((rows ?? []).map((r) => r.seq as number));
  let error: { message: string } | null = null;
  if (formData.get("undo") === "1") {
    const last = Math.max(0, ...paid);
    if (last > 0) ({ error } = await supabase.from("installment_payments").delete().eq("installment_id", id).eq("seq", last));
  } else {
    let next = 1;
    while (paid.has(next)) next++;
    if (next <= inst.term_count) ({ error } = await supabase.from("installment_payments").insert({ installment_id: id, seq: next }));
  }
  back("installments", error ? "failed" : undefined, error);
}

export async function deleteInstalment(formData: FormData) {
  const supabase = await requireAuthed();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) back("installments", "failed");
  const { error } = await supabase.from("installments").delete().eq("id", id);
  if (!error) await syncCommitments(supabase);
  back("installments", error ? "failed" : undefined, error);
}

// Called quietly from Now and Budget so the Installments and Subscriptions budget lines follow the month without a button.
export async function autoSyncCommitments(): Promise<boolean> {
  const supabase = await requireAuthed();
  const result = await syncCommitments(supabase);
  if (result === "ok") for (const p of ["/", "/budget", "/transfer"]) revalidatePath(p);
  return result === "ok";
}
