"use server";

import { revalidatePath } from "next/cache";
import { requireAuthed } from "@/lib/auth/require";
import type { FormState } from "@/lib/form-state";
import { resolveHeldRow } from "@/lib/capture/held";
import { TRANSFER_CATEGORY } from "@/lib/capture/transfer-category";
import { normalizePattern } from "@/lib/inbox/rules";
import { transferHoldUntil, type HoldAccount } from "@/lib/capture/hold";

const manilaTime = (ms: number) => new Date(ms).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });

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
export async function confirmTransaction(input: { id: string; categoryId: string | null; rule: boolean; note: string; billId?: string | null }): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!UUID.test(input.id)) return { error: "That transaction was not found." };
  const row = await supabase.from("transactions").select("id, kind, status, merchant, transfer_peer_id, account_id, occurred_at, source, amount").eq("id", input.id).maybeSingle();
  if (!row.data || row.data.status !== "pending") return { error: "That one is no longer waiting." };

  // "Pays a bill": the payment marks that bill sent for the cutoff. Only money going out can pay one.
  let billId: string | null = null;
  if (input.billId) {
    if (!UUID.test(input.billId) || Number(row.data.amount) >= 0) return { error: "That bill was not found." };
    const line = await supabase.from("budget_lines_v2").select("id").eq("id", input.billId).not("account_id", "is", null).maybeSingle();
    if (!line.data) return { error: "That bill was not found." };
    billId = input.billId;
  }

  const isTransfer = row.data.kind === "transfer";
  let categoryId: string | null = null;
  // Picking the Transfer category says it was a move between your own accounts, so it stops counting as spending or income.
  let becomesTransfer = false;
  if (!isTransfer) {
    if (!input.categoryId || !UUID.test(input.categoryId)) return { error: "Pick a category first." };
    const cat = await supabase.from("categories").select("id, name").eq("id", input.categoryId).maybeSingle();
    if (!cat.data) return { error: "That category was not found." };
    categoryId = input.categoryId;
    becomesTransfer = cat.data.name === TRANSFER_CATEGORY;
    // A transfer-looking item waits a few minutes for its other side before it can count as spending or income.
    if (!becomesTransfer) {
      const accts = await supabase.from("accounts").select("id, name, institution").is("archived_at", null);
      const until = transferHoldUntil(
        { status: row.data.status, kind: row.data.kind, source: row.data.source, occurredAt: row.data.occurred_at, counterparty: row.data.merchant, accountId: row.data.account_id },
        (accts.data ?? []) as HoldAccount[],
        Date.now(),
      );
      if (until !== null) return { error: `This may be a transfer between your accounts. Wait until ${manilaTime(until)} for the other side, or file it under ${TRANSFER_CATEGORY}.` };
    }
  }

  const now = new Date().toISOString();
  const note = input.note.trim().slice(0, 200) || null;
  const ids = [row.data.id as string, ...(isTransfer && row.data.transfer_peer_id ? [row.data.transfer_peer_id as string] : [])];
  const upd = await supabase.from("transactions").update({ status: "confirmed", confirmed_at: now, category_id: categoryId, note, ...(becomesTransfer ? { kind: "transfer" } : {}) }).in("id", ids).eq("status", "pending");
  if (upd.error) return { error: "Could not confirm that. Try again." };
  if (billId) {
    const link = await supabase.from("transactions").update({ budget_line_id: billId }).eq("id", row.data.id);
    if (link.error) return { error: "Confirmed, but it was not linked to the bill. Mark the bill sent on Now." };
  }

  const pattern = normalizePattern(row.data.merchant as string | null);
  if (input.rule && categoryId && pattern) {
    const exists = await supabase.from("merchant_rules").select("id").ilike("pattern", pattern.replace(/[%_\\]/g, "\\$&")).eq("category_id", categoryId).maybeSingle();
    if (!exists.data) await supabase.from("merchant_rules").insert({ pattern, category_id: categoryId, priority: 0 });
  }
  refresh();
  return { ok: true };
}

/** Answers a capture the phone held because no account claimed it: which account, where the money went or came from, and the category. It is confirmed at once. */
export async function resolveHeldCapture(input: { hash: string; accountId: string | null; otherAccountId: string | null; categoryId: string | null }): Promise<FormState> {
  const supabase = await requireAuthed();
  if (typeof input.hash !== "string" || input.hash.length < 8 || input.hash.length > 128) return { error: "That capture was not found." };
  if (input.otherAccountId !== null && !UUID.test(input.otherAccountId)) return { error: "Pick an account from the list." };
  let otherName: string | null = null;
  if (input.accountId && input.otherAccountId) {
    const o = await supabase.from("accounts").select("name").eq("id", input.otherAccountId).is("archived_at", null).maybeSingle();
    otherName = (o.data?.name as string | undefined) ?? null;
  }
  if (input.categoryId !== null && !UUID.test(input.categoryId)) return { error: "Pick a category from the list." };
  const r = await resolveHeldRow(supabase, { hash: input.hash, accountId: input.accountId, otherName, otherAccountId: otherName ? input.otherAccountId : null, categoryId: input.categoryId });
  if ("error" in r) return { error: r.error };
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
