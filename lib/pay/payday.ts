import type { SupabaseClient } from "@supabase/supabase-js";
import type { YearMonth } from "@/lib/domain/dates";
import { parsePesos } from "@/lib/domain/money";
import type { PayCutoff } from "@/lib/engine/types";

/** The merchant on the income row a payday writes, so the prompt knows this cutoff's pay is already in. */
export const PAY_MERCHANT = "Pay";

/** How many days into a cutoff the "Has the pay arrived?" prompt keeps asking. */
export const PAYDAY_PROMPT_DAYS = 7;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 100_000_000_000;

export interface BonusRuleLite {
  name: string;
  recurrence: "yearly" | "once";
  pay_month: number;
  once_on: string | null;
  payslip_cutoff: PayCutoff;
}

/** Bonuses whose rule pays them with this month's pay on this cutoff. */
export function bonusesLanding(rules: readonly BonusRuleLite[], month: YearMonth, cutoff: PayCutoff): string[] {
  const m = Number(month.slice(5, 7));
  return rules
    .filter((r) => r.payslip_cutoff === cutoff && (r.recurrence === "yearly" ? r.pay_month === m : (r.once_on ?? "").slice(0, 7) === month))
    .map((r) => r.name);
}

/** Whether this cutoff's pay is already recorded: an income row written by the payday prompt that is not ignored. */
export function payRecorded(txns: readonly { kind: string; status: string; merchant: string | null }[]): boolean {
  return txns.some((t) => t.kind === "income" && t.status !== "ignored" && t.merchant === PAY_MERCHANT);
}

export type PaydayResult = { ok: true } | { error: string };

/** Records the pay as confirmed income on the account, and remembers that account for the next payday. */
export async function recordPay(supabase: SupabaseClient, input: { accountId: string; amount: string }): Promise<PaydayResult> {
  if (!UUID.test(input.accountId)) return { error: "Pick the account the pay went into." };
  const amount = parsePesos(input.amount.trim());
  if (amount === undefined || amount <= 0 || amount > MAX) return { error: "Enter the take-home, like 25,000.00." };
  const acct = await supabase.from("accounts").select("id").eq("id", input.accountId).is("archived_at", null).maybeSingle();
  if (!acct.data) return { error: "That account was not found." };

  const now = new Date().toISOString();
  const ins = await supabase.from("transactions").insert({
    account_id: input.accountId, occurred_at: now, amount, merchant: PAY_MERCHANT, kind: "income", source: "manual", status: "confirmed", confirmed_at: now,
  });
  if (ins.error) return { error: "Could not save the pay. Try again." };
  // Remembering the account is a convenience; the pay is saved even if this fails (for example before the database update).
  const existing = await supabase.from("user_settings").select("user_id").maybeSingle();
  if (existing.data) await supabase.from("user_settings").update({ pay_account_id: input.accountId }).eq("user_id", existing.data.user_id);
  return { ok: true };
}

/** Saves which categories the Now "Planned vs spent" panel shows; null shows them all. */
export async function saveNowCategories(supabase: SupabaseClient, ids: string[] | null): Promise<PaydayResult> {
  if (ids !== null && (ids.length > 200 || ids.some((id) => !UUID.test(id)))) return { error: "Pick categories from the list." };
  const existing = await supabase.from("user_settings").select("user_id").maybeSingle();
  const r = existing.data
    ? await supabase.from("user_settings").update({ now_categories: ids }).eq("user_id", existing.data.user_id)
    : await supabase.from("user_settings").insert({ now_categories: ids });
  if (r.error) return { error: r.error.code === "42703" ? "Apply the rev-36 database update first." : "Could not save that. Try again." };
  return { ok: true };
}
