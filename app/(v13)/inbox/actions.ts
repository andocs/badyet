"use server";

import { revalidatePath } from "next/cache";
import { requireAuthed } from "@/lib/auth/require";
import type { FormState } from "@/lib/form-state";
import { normalizePattern } from "@/lib/inbox/rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refresh = () => {
  revalidatePath("/inbox");
  revalidatePath("/");
  revalidatePath("/accounts");
};

/**
 * Confirms a pending row. A normal row needs a category; a transfer does not, and confirming one also confirms its other leg.
 * With `rule`, "always put this merchant under this category" is saved. Only confirmed rows move balances.
 */
export async function confirmTransaction(input: { id: string; categoryId: string | null; rule: boolean; note: string }): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!UUID.test(input.id)) return { error: "That transaction was not found." };
  const row = await supabase.from("transactions").select("id, kind, status, merchant, transfer_peer_id").eq("id", input.id).maybeSingle();
  if (!row.data || row.data.status !== "pending") return { error: "That one is no longer waiting." };

  const isTransfer = row.data.kind === "transfer";
  let categoryId: string | null = null;
  if (!isTransfer) {
    if (!input.categoryId || !UUID.test(input.categoryId)) return { error: "Pick a category first." };
    const cat = await supabase.from("categories").select("id").eq("id", input.categoryId).maybeSingle();
    if (!cat.data) return { error: "That category was not found." };
    categoryId = input.categoryId;
  }

  const now = new Date().toISOString();
  const note = input.note.trim().slice(0, 200) || null;
  const ids = [row.data.id as string, ...(isTransfer && row.data.transfer_peer_id ? [row.data.transfer_peer_id as string] : [])];
  const upd = await supabase.from("transactions").update({ status: "confirmed", confirmed_at: now, category_id: categoryId, note }).in("id", ids).eq("status", "pending");
  if (upd.error) return { error: "Could not confirm that. Try again." };

  const pattern = normalizePattern(row.data.merchant as string | null);
  if (input.rule && categoryId && pattern) {
    const exists = await supabase.from("merchant_rules").select("id").ilike("pattern", pattern.replace(/[%_\\]/g, "\\$&")).eq("category_id", categoryId).maybeSingle();
    if (!exists.data) await supabase.from("merchant_rules").insert({ pattern, category_id: categoryId, priority: 0 });
  }
  refresh();
  return { ok: true };
}

/** "Not mine": the row is ignored. It never counts and no longer shows. */
export async function ignoreTransaction(id: string): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!UUID.test(id)) return { error: "That transaction was not found." };
  const row = await supabase.from("transactions").select("id, kind, status, transfer_peer_id").eq("id", id).maybeSingle();
  if (!row.data || row.data.status !== "pending") return { error: "That one is no longer waiting." };
  const ids = [row.data.id as string, ...(row.data.kind === "transfer" && row.data.transfer_peer_id ? [row.data.transfer_peer_id as string] : [])];
  const upd = await supabase.from("transactions").update({ status: "ignored" }).in("id", ids).eq("status", "pending");
  if (upd.error) return { error: "Could not update that. Try again." };
  refresh();
  return { ok: true };
}
