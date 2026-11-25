import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePesos } from "@/lib/domain/money";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 100_000_000_000;

export type BillResult = { ok: true } | { error: string };

/**
 * Marks a bill (a budget line that goes to an account) sent: the money really moves, and the rows carry the line so Now shows it
 * sent for the cutoff. Paid from another of your accounts, it is a transfer into the line's account; paid out of the line's own
 * account, it is spending in the line's category.
 */
export async function markBillSent(supabase: SupabaseClient, input: { lineId: string; from: string; amount: string }): Promise<BillResult> {
  if (!UUID.test(input.lineId)) return { error: "That bill was not found." };
  if (!UUID.test(input.from)) return { error: "Pick the account it was paid from." };
  const amount = parsePesos(input.amount.trim());
  if (amount === undefined || amount <= 0 || amount > MAX) return { error: "Enter an amount above zero." };

  const line = await supabase.from("budget_lines_v2").select("id, name, account_id, category_id").eq("id", input.lineId).maybeSingle();
  const to = line.data?.account_id as string | null | undefined;
  if (!line.data || !to) return { error: "That bill was not found." };
  const owned = await supabase.from("accounts").select("id").in("id", [...new Set([input.from, to])]).is("archived_at", null);
  if ((owned.data ?? []).length !== (input.from === to ? 1 : 2)) return { error: "One of those accounts was not found." };

  const now = new Date().toISOString();
  const base = { occurred_at: now, merchant: String(line.data.name).slice(0, 80), status: "confirmed", confirmed_at: now, budget_line_id: input.lineId };
  if (input.from === to) {
    const r = await supabase.from("transactions").insert({ ...base, account_id: to, amount: -amount, kind: "expense", category_id: line.data.category_id, source: "manual" });
    return r.error ? { error: "Could not save that. Try again." } : { ok: true };
  }
  const { data, error } = await supabase
    .from("transactions")
    .insert([
      { ...base, account_id: input.from, amount: -amount, kind: "transfer", source: "transfer" },
      { ...base, account_id: to, amount, kind: "transfer", source: "transfer" },
    ])
    .select("id, account_id");
  if (error || !data || data.length !== 2) return { error: "Could not save that. Try again." };
  const out = data.find((r) => r.account_id === input.from)!;
  const inn = data.find((r) => r.account_id === to)!;
  const a = await supabase.from("transactions").update({ transfer_peer_id: inn.id }).eq("id", out.id);
  const b = await supabase.from("transactions").update({ transfer_peer_id: out.id }).eq("id", inn.id);
  return a.error || b.error ? { error: "The money moved but the two sides were not linked. Check Inbox." } : { ok: true };
}

/**
 * Undoes "sent": a payment made with Mark sent (or typed by hand) is cancelled with its other side; a captured payment you linked
 * in the Inbox stays, only no longer marks the bill.
 */
export async function undoBillSent(supabase: SupabaseClient, txnId: string): Promise<BillResult> {
  if (!UUID.test(txnId)) return { error: "That payment was not found." };
  const row = await supabase.from("transactions").select("id, source, status, budget_line_id, transfer_peer_id").eq("id", txnId).maybeSingle();
  if (!row.data || row.data.status !== "confirmed" || !row.data.budget_line_id) return { error: "That payment was not found." };
  const ids = [row.data.id as string, ...(row.data.transfer_peer_id ? [row.data.transfer_peer_id as string] : [])];
  const captured = row.data.source === "notification" || row.data.source === "import";
  const r = captured
    ? await supabase.from("transactions").update({ budget_line_id: null }).in("id", ids)
    : await supabase.from("transactions").update({ status: "ignored" }).in("id", ids);
  return r.error ? { error: "Could not undo that. Try again." } : { ok: true };
}
