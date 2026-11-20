"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthed } from "@/lib/auth/require";
import { isCutoff, type Cutoff } from "@/lib/budget/validate";
import { dueByCutoff, type InstalmentRow } from "@/lib/installments/calc";
import { parseInstalmentForm } from "@/lib/installments/input";
import { money, sum } from "@/lib/domain/money";
import { isPastPlan, isUuid } from "@/lib/plans/validate";
import { currentMonth } from "@/lib/transfer/month";

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
  back("installments", error ? "failed" : undefined, error);
}

// Keeps one Essentials budget line per cutoff for installments and one for subscriptions,
// equal to what is due this month. Other budget lines are never touched (they have no `source`).
export async function syncBudget(formData: FormData) {
  const supabase = await requireAuthed();
  const page = formData.get("page") === "subscriptions" ? "subscriptions" : "installments";

  const { data: plan } = await supabase.from("plans").select("id,end_date").eq("is_active", true).maybeSingle();
  if (!plan) back(page, "noplan");
  if (isPastPlan(plan.end_date)) back(page, "past");

  const month = currentMonth();
  const { data: instRows } = await supabase.from("installments").select("*");
  const { data: subRows } = await supabase.from("subscriptions").select("cutoff,amount").eq("active", true);
  const rows: InstalmentRow[] = (instRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    price: money(r.price),
    downPayment: money(r.down_payment),
    termCount: r.term_count,
    rateBp: r.rate_bp,
    firstDueOn: r.first_due_on,
    cutoff: r.cutoff,
    walletId: r.wallet_id,
  }));
  const inst = dueByCutoff(rows, month);
  const subTotal = (c: Cutoff) => sum((subRows ?? []).filter((s) => isCutoff(s.cutoff) && s.cutoff === c).map((s) => money(s.amount)));

  const targets = (["first", "second"] as const).flatMap((cutoff) => [
    { cutoff, source: "installments" as const, name: "Installments", amount: inst[cutoff] },
    { cutoff, source: "subscriptions" as const, name: "Subscriptions", amount: subTotal(cutoff) },
  ]);

  for (const t of targets) {
    const { data: existing } = await supabase
      .from("budget_lines")
      .select("id")
      .eq("plan_id", plan.id)
      .eq("cutoff", t.cutoff)
      .eq("source", t.source)
      .maybeSingle();
    let error: { message: string } | null = null;
    if (existing && t.amount > 0) ({ error } = await supabase.from("budget_lines").update({ amount: t.amount }).eq("id", existing.id));
    else if (existing) ({ error } = await supabase.from("budget_lines").delete().eq("id", existing.id));
    else if (t.amount > 0) {
      ({ error } = await supabase
        .from("budget_lines")
        .insert({ plan_id: plan.id, cutoff: t.cutoff, bucket: "essentials", name: t.name, amount: t.amount, source: t.source }));
    }
    if (error) back(page, "failed", error);
  }
  revalidatePath("/transfer");
  redirect(`/${page}?synced=1`);
}
