"use server";

import { revalidatePath } from "next/cache";
import { requireAuthed } from "@/lib/auth/require";
import { isCutoff } from "@/lib/budget/validate";
import { isUuid } from "@/lib/plans/validate";
import { applyMarks } from "@/lib/transfer/marks";
import { isMonth } from "@/lib/transfer/month";

function refresh() {
  for (const p of ["/", "/transfer", "/accounts"]) revalidatePath(p);
}

// Called from the dashboard (not a form): returns whether it saved, so the page can undo on failure.
// Ticking also moves the destination account's balance (see lib/transfer/marks.ts).
export async function setSent(lineId: string, month: string, sent: boolean): Promise<boolean> {
  const supabase = await requireAuthed();
  if (!isUuid(lineId) || !isMonth(month)) return false;
  const error = await applyMarks(supabase, [lineId], month, sent);
  if (error) console.error("[dashboard] setSent:", error.message);
  refresh();
  return !error;
}

export async function markAllSent(month: string, cutoff: string): Promise<boolean> {
  const supabase = await requireAuthed();
  if (!isMonth(month) || !isCutoff(cutoff)) return false;
  const { data: plan } = await supabase.from("plans").select("id").eq("is_active", true).maybeSingle();
  if (!plan) return false;
  const { data: lines } = await supabase.from("budget_lines").select("id").eq("plan_id", plan.id).eq("cutoff", cutoff);
  const error = await applyMarks(supabase, (lines ?? []).map((l) => l.id as string), month, true);
  if (error) console.error("[dashboard] markAllSent:", error.message);
  refresh();
  return !error;
}

// Marks one payment of an installment (1, 2, 3 ...) paid or not paid, from the payday steps.
export async function setInstalmentPayment(installmentId: string, seq: number, paid: boolean): Promise<boolean> {
  const supabase = await requireAuthed();
  if (!isUuid(installmentId) || !Number.isInteger(seq) || seq < 1 || seq > 600) return false;
  const { error } = paid
    ? await supabase.from("installment_payments").upsert({ installment_id: installmentId, seq }, { onConflict: "installment_id,seq", ignoreDuplicates: true })
    : await supabase.from("installment_payments").delete().eq("installment_id", installmentId).eq("seq", seq);
  if (error) console.error("[dashboard] setInstalmentPayment:", error.message);
  revalidatePath("/");
  revalidatePath("/installments");
  return !error;
}
