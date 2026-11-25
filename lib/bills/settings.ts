import type { SupabaseClient } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type SettingsResult = { ok: true } | { error: string };

/** The account your pay lands in: the checklist sends from it. Also set from the payday prompt. */
export async function setPayAccount(supabase: SupabaseClient, accountId: string): Promise<SettingsResult> {
  if (!UUID.test(accountId)) return { error: "Pick an account from the list." };
  const acct = await supabase.from("accounts").select("id").eq("id", accountId).is("archived_at", null).maybeSingle();
  if (!acct.data) return { error: "That account was not found." };
  const existing = await supabase.from("user_settings").select("user_id").maybeSingle();
  const r = existing.data ? await supabase.from("user_settings").update({ pay_account_id: accountId }).eq("user_id", existing.data.user_id) : await supabase.from("user_settings").insert({ pay_account_id: accountId });
  if (r.error) return { error: r.error.code === "42703" ? "Apply the payday database update first." : "Could not save that. Try again." };
  return { ok: true };
}

/** The wallet a budget line's money is sent to. Setting one makes the line show on the pay checklist. */
export async function setLineWallet(supabase: SupabaseClient, lineId: string, accountId: string): Promise<SettingsResult> {
  if (!UUID.test(lineId) || !UUID.test(accountId)) return { error: "Pick a wallet from the list." };
  const acct = await supabase.from("accounts").select("id").eq("id", accountId).is("archived_at", null).maybeSingle();
  if (!acct.data) return { error: "That account was not found." };
  const r = await supabase.from("budget_lines_v2").update({ account_id: accountId }).eq("id", lineId).select("id");
  if (r.error || !r.data || r.data.length === 0) return { error: "Could not save that. Try again." };
  return { ok: true };
}
