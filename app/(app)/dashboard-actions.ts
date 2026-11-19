"use server";

import { revalidatePath } from "next/cache";
import { requireAuthed } from "@/lib/auth/require";
import { isCutoff } from "@/lib/budget/validate";
import { isUuid } from "@/lib/plans/validate";
import { isMonth } from "@/lib/transfer/month";

// Called from the dashboard (not a form): returns whether it saved, so the page can undo on failure.
export async function setSent(lineId: string, month: string, sent: boolean): Promise<boolean> {
  const supabase = await requireAuthed();
  if (!isUuid(lineId) || !isMonth(month)) return false;
  const { error } = sent
    ? await supabase.from("transfer_marks").upsert({ line_id: lineId, month }, { onConflict: "line_id,month", ignoreDuplicates: true })
    : await supabase.from("transfer_marks").delete().eq("line_id", lineId).eq("month", month);
  if (error) console.error("[dashboard] setSent:", error.message);
  revalidatePath("/");
  revalidatePath("/transfer");
  return !error;
}

export async function markAllSent(month: string, cutoff: string): Promise<boolean> {
  const supabase = await requireAuthed();
  if (!isMonth(month) || !isCutoff(cutoff)) return false;
  const { data: plan } = await supabase.from("plans").select("id").eq("is_active", true).maybeSingle();
  if (!plan) return false;
  const { data: lines } = await supabase.from("budget_lines").select("id").eq("plan_id", plan.id).eq("cutoff", cutoff);
  const rows = (lines ?? []).map((l) => ({ line_id: l.id as string, month }));
  if (rows.length === 0) return true;
  const { error } = await supabase.from("transfer_marks").upsert(rows, { onConflict: "line_id,month", ignoreDuplicates: true });
  if (error) console.error("[dashboard] markAllSent:", error.message);
  revalidatePath("/");
  revalidatePath("/transfer");
  return !error;
}
