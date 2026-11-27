import type { SupabaseClient } from "@supabase/supabase-js";
import { isMoveCategory } from "@/lib/capture/transfer-category";
import { checkLinkedEdit, findLoanLink, keepsLink, linkLoanItem, unlinkLoanItem, type EditLending } from "@/lib/lending/edit";
import type { Env } from "@/lib/lending/write";
import { isoDate } from "@/lib/domain/dates";
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
  /** The category: an id, or null/empty for none. Left alone when not given. Not used for a transfer. */
  categoryId?: string | null;
  /** YYYY-MM-DD. */
  date: string;
  /** HH:mm, 24-hour. */
  time: string;
  note: string;
  /** "Others": whose account the money went to. Left alone when not given; empty clears it. */
  otherOwner?: string;
  /** How to file it for lending: a loan, a payback, or no longer either. Left alone when not given. */
  lending?: EditLending;
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
  /** undefined = leave the category as it is; null = no category. */
  categoryId: string | null | undefined;
  /** ISO timestamp. */
  occurredAt: string;
  note: string | null;
  /** undefined = leave it; null = clear it. */
  otherOwner?: string | null;
}

export function validateEdit(input: EditInput): Checked<EditValue> {
  if (!UUID.test(input.id)) return { ok: false, error: "That item was not found." };
  const merchant = input.merchant.trim().replace(/\s+/g, " ");
  if (merchant.length > 80) return { ok: false, error: "Keep the name under 80 characters." };
  const amount = parsePesos(input.amount.trim());
  if (amount === undefined || amount <= 0 || amount > MAX) return { ok: false, error: "Enter an amount above zero, like 250 or 1,250.50." };
  if (input.direction !== "in" && input.direction !== "out") return { ok: false, error: "Say whether the money went out or came in." };
  if (!UUID.test(input.accountId)) return { ok: false, error: "Pick an account." };
  const categoryId = input.categoryId === undefined ? undefined : input.categoryId === null || input.categoryId === "" ? null : input.categoryId;
  if (categoryId && !UUID.test(categoryId)) return { ok: false, error: "That category was not found." };
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date.trim());
  const time = /^(\d{1,2}):(\d{2})$/.exec(input.time.trim());
  if (!date || !time || +time[1]! > 23 || +time[2]! > 59) return { ok: false, error: "Enter the date as 2026-11-25 and the time as 10:02." };
  const occurredAt = new Date(`${date[1]}-${date[2]}-${date[3]}T${time[1]!.padStart(2, "0")}:${time[2]}:00+08:00`);
  // Rolled over (a 31st that does not exist) or not a date at all.
  if (Number.isNaN(occurredAt.getTime()) || new Date(occurredAt.getTime() + 8 * 3_600_000).toISOString().slice(0, 10) !== input.date.trim()) return { ok: false, error: "That date does not exist." };
  const note = input.note.trim().slice(0, 200);
  const owner = input.otherOwner === undefined ? undefined : input.otherOwner.trim().replace(/\s+/g, " ").slice(0, 80) || null;
  return { ok: true, value: { ...(owner === undefined ? {} : { otherOwner: owner }), merchant: merchant === "" ? null : merchant, amount, direction: input.direction, accountId: input.accountId, categoryId, occurredAt: occurredAt.toISOString(), note: note === "" ? null : note } };
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
 * An item that belongs to a loan keeps the loan in step; `lending` files an item as a loan or payback, or takes it out of one.
 * `env` is needed only for that last part.
 */
export async function editTransaction(supabase: SupabaseClient, input: EditInput, env?: Env): Promise<EditResult> {
  const v = validateEdit(input);
  if (!v.ok) return { error: v.error };
  const e = v.value;
  const row = await supabase.from("transactions").select("id, kind, status, transfer_peer_id, amount").eq("id", input.id).maybeSingle();
  if (!row.data || row.data.status === "ignored") return { error: "That item was not found." };
  const owner = e.otherOwner === undefined ? {} : { other_owner: e.otherOwner };

  const lone = !row.data.transfer_peer_id;
  const link = lone ? await findLoanLink(supabase, input.id) : null;
  const wanted = input.lending;
  let kind = row.data.kind as "expense" | "income" | "transfer";
  if (link && keepsLink(link, wanted)) {
    // The item and its loan change together; both are checked before either is written.
    const date = isoDate(input.date.trim());
    const direction = link.role === "lent" ? "out" : "in";
    const next = await checkLinkedEdit(supabase, link, { amount: e.amount, direction, date }, wanted);
    if ("error" in next) return { error: next.error };
    const acct = await supabase.from("accounts").select("id").eq("id", e.accountId).is("archived_at", null).maybeSingle();
    if (!acct.data) return { error: "That account was not found." };
    const moved = await supabase.from("transactions").update({ amount: direction === "out" ? -e.amount : e.amount, account_id: e.accountId, occurred_at: e.occurredAt, merchant: e.merchant, note: e.note, ...owner }).eq("id", input.id);
    if (moved.error) return { error: "Could not change that. Try again." };
    const values = next.table === "loans" ? { ...next.values, account_id: e.accountId } : next.values;
    const saved = await supabase.from(next.table).update(values).eq("id", next.id);
    return saved.error ? { error: "The item changed, but the loan did not. Save it again." } : { ok: true };
  }
  if (wanted && wanted.as !== "none") {
    if (!lone) return { error: "That one is a move between your own accounts." };
    if (!env) return { error: "Could not change that. Try again." };
    if (wanted.as === "loan" ? e.direction !== "out" : e.direction !== "in") return { error: wanted.as === "loan" ? "Only money going out can be lent." : "Only money coming in can be a payback." };
  }
  if (link) {
    const freed = await unlinkLoanItem(supabase, link);
    if ("error" in freed) return { error: freed.error };
    kind = e.direction === "out" ? "expense" : "income";
  }

  // A move between your own accounts keeps its two sides. A transfer with one side can change account like anything else.
  if (kind === "transfer" && !lone) {
    const peerId = row.data.transfer_peer_id as string | null;
    const legs = await supabase.from("transactions").select("id, amount").in("id", peerId ? [row.data.id, peerId] : [row.data.id]);
    if (legs.error || !legs.data || legs.data.length === 0) return { error: "Could not change that. Try again." };
    for (const leg of legs.data as { id: string; amount: number }[]) {
      const r = await supabase.from("transactions").update({ amount: leg.amount < 0 ? -e.amount : e.amount, occurred_at: e.occurredAt, merchant: e.merchant, note: e.note, ...owner }).eq("id", leg.id);
      if (r.error) return { error: "Could not change that. Try again." };
    }
    return { ok: true };
  }

  const acct = await supabase.from("accounts").select("id").eq("id", e.accountId).is("archived_at", null).maybeSingle();
  if (!acct.data) return { error: "That account was not found." };
  if (kind === "transfer") {
    const sign = Number(row.data.amount) < 0 ? -1 : 1;
    const r = await supabase.from("transactions").update({ amount: sign * e.amount, account_id: e.accountId, occurred_at: e.occurredAt, merchant: e.merchant, note: e.note, ...owner }).eq("id", row.data.id);
    if (r.error) return { error: "Could not change that. Try again." };
    return wanted && wanted.as !== "none" ? thenLink(supabase, input.id, wanted, e.note, env!) : { ok: true };
  }
  let movesBetweenYours = false;
  if (e.categoryId) {
    const cat = await supabase.from("categories").select("id, name").eq("id", e.categoryId).is("archived_at", null).maybeSingle();
    if (!cat.data) return { error: "That category was not found." };
    // "Credit card payment" (like Transfer) is a move between your own accounts, so it stops counting as spending or income.
    movesBetweenYours = isMoveCategory(cat.data.name as string);
  }
  const r = await supabase
    .from("transactions")
    .update({
      amount: e.direction === "out" ? -e.amount : e.amount, kind: movesBetweenYours ? "transfer" : e.direction === "out" ? "expense" : "income", account_id: e.accountId, occurred_at: e.occurredAt, merchant: e.merchant, note: e.note,
      ...(e.categoryId !== undefined ? { category_id: e.categoryId } : {}),
      ...owner,
    })
    .eq("id", row.data.id);
  if (r.error) return { error: "Could not change that. Try again." };
  return wanted && wanted.as !== "none" ? thenLink(supabase, input.id, wanted, e.note, env!) : { ok: true };
}

async function thenLink(supabase: SupabaseClient, id: string, lending: Exclude<EditLending, { as: "none" }>, note: string | null, env: Env): Promise<EditResult> {
  const r = await linkLoanItem(supabase, id, lending, note ?? "", env);
  return "error" in r ? { error: `Your other changes were saved, but it was not filed for lending: ${r.error}` } : { ok: true };
}
