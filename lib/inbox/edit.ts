import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePesos } from "@/lib/domain/money";

/** What can be changed on an Inbox item. Dates and times are Philippine time, the way you read them. */
export interface EditInput {
  id: string;
  /** Who it was with or what it was for. */
  merchant: string;
  /** Pesos as typed, always positive. */
  amount: string;
  /** Whether the money went out or came in (not used for a transfer, which keeps its two sides). */
  direction: "in" | "out";
  accountId: string;
  /** YYYY-MM-DD. */
  date: string;
  /** HH:mm, 24-hour. */
  time: string;
  note: string;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };
export type EditResult = { ok: true } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 100_000_000_000;

export interface EditValue {
  merchant: string | null;
  amount: number;
  direction: "in" | "out";
  accountId: string;
  /** ISO timestamp. */
  occurredAt: string;
  note: string | null;
}

export function validateEdit(input: EditInput): Checked<EditValue> {
  if (!UUID.test(input.id)) return { ok: false, error: "That item was not found." };
  const merchant = input.merchant.trim().replace(/\s+/g, " ");
  if (merchant.length > 80) return { ok: false, error: "Keep the name under 80 characters." };
  const amount = parsePesos(input.amount.trim());
  if (amount === undefined || amount <= 0 || amount > MAX) return { ok: false, error: "Enter an amount above zero, like 250 or 1,250.50." };
  if (input.direction !== "in" && input.direction !== "out") return { ok: false, error: "Say whether the money went out or came in." };
  if (!UUID.test(input.accountId)) return { ok: false, error: "Pick an account." };
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date.trim());
  const time = /^(\d{1,2}):(\d{2})$/.exec(input.time.trim());
  if (!date || !time || +time[1]! > 23 || +time[2]! > 59) return { ok: false, error: "Enter the date as 2026-11-25 and the time as 10:02." };
  const occurredAt = new Date(`${date[1]}-${date[2]}-${date[3]}T${time[1]!.padStart(2, "0")}:${time[2]}:00+08:00`);
  // Rolled over (a 31st that does not exist) or not a date at all.
  if (Number.isNaN(occurredAt.getTime()) || new Date(occurredAt.getTime() + 8 * 3_600_000).toISOString().slice(0, 10) !== input.date.trim()) return { ok: false, error: "That date does not exist." };
  const note = input.note.trim().slice(0, 200);
  return { ok: true, value: { merchant: merchant === "" ? null : merchant, amount, direction: input.direction, accountId: input.accountId, occurredAt: occurredAt.toISOString(), note: note === "" ? null : note } };
}

/** The date (YYYY-MM-DD) and time (HH:mm) of an ISO timestamp in Philippine time, for filling the form. */
export function manilaFields(iso: string): { date: string; time: string } {
  const local = new Date(Date.parse(iso) + 8 * 3_600_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

/**
 * Changes an Inbox item, pending or confirmed. A move between your own accounts keeps its two sides: the amount, time, name and note
 * change on both. Anything else can also change direction and account. The capture's duplicate key is left alone, so the same
 * notification is not added again. Balances follow the confirmed rows, so a confirmed item moves them straight away.
 */
export async function editTransaction(supabase: SupabaseClient, input: EditInput): Promise<EditResult> {
  const v = validateEdit(input);
  if (!v.ok) return { error: v.error };
  const e = v.value;
  const row = await supabase.from("transactions").select("id, kind, status, transfer_peer_id").eq("id", input.id).maybeSingle();
  if (!row.data || row.data.status === "ignored") return { error: "That item was not found." };

  if (row.data.kind === "transfer") {
    const peerId = row.data.transfer_peer_id as string | null;
    const legs = await supabase.from("transactions").select("id, amount").in("id", peerId ? [row.data.id, peerId] : [row.data.id]);
    if (legs.error || !legs.data || legs.data.length === 0) return { error: "Could not change that. Try again." };
    for (const leg of legs.data as { id: string; amount: number }[]) {
      const r = await supabase.from("transactions").update({ amount: leg.amount < 0 ? -e.amount : e.amount, occurred_at: e.occurredAt, merchant: e.merchant, note: e.note }).eq("id", leg.id);
      if (r.error) return { error: "Could not change that. Try again." };
    }
    return { ok: true };
  }

  const acct = await supabase.from("accounts").select("id").eq("id", e.accountId).is("archived_at", null).maybeSingle();
  if (!acct.data) return { error: "That account was not found." };
  const r = await supabase
    .from("transactions")
    .update({ amount: e.direction === "out" ? -e.amount : e.amount, kind: e.direction === "out" ? "expense" : "income", account_id: e.accountId, occurred_at: e.occurredAt, merchant: e.merchant, note: e.note })
    .eq("id", row.data.id);
  return r.error ? { error: "Could not change that. Try again." } : { ok: true };
}
