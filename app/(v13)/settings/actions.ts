"use server";

import { revalidatePath } from "next/cache";
import { requireAuthed } from "@/lib/auth/require";
import type { FormState } from "@/lib/form-state";
import { parsePesos } from "@/lib/domain/money";
import { validatePaydays } from "@/lib/setup/input";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refresh = () => {
  for (const p of ["/", "/budget", "/forecast", "/settings", "/inbox"]) revalidatePath(p);
};

/** Updates your settings row (creating it the first time). */
async function saveSettingsRow(supabase: Awaited<ReturnType<typeof requireAuthed>>, values: Record<string, unknown>): Promise<boolean> {
  const stamped = { ...values, updated_at: new Date().toISOString() };
  const existing = await supabase.from("user_settings").select("user_id").maybeSingle();
  const { error } = existing.data ? await supabase.from("user_settings").update(stamped).eq("user_id", existing.data.user_id) : await supabase.from("user_settings").insert(stamped);
  return !error;
}

export async function savePaydays(input: { first: number; second: number }): Promise<FormState> {
  const supabase = await requireAuthed();
  const v = validatePaydays(input.first, input.second);
  if (!v.ok) return { error: v.error };
  const ok = await saveSettingsRow(supabase, { first_payday_day: v.value.first, second_payday_day: v.value.second, first_cutoff_start_day: v.value.first + 1, second_cutoff_start_day: v.value.second });
  if (!ok) return { error: "That did not save. Try again." };
  refresh();
  return { ok: true };
}

/** The peso amount added to the daily amount on a usual office day. */
export async function saveOfficeAmount(text: string): Promise<FormState> {
  const supabase = await requireAuthed();
  const v = parsePesos(text.trim() === "" ? "0" : text);
  if (v === undefined || v < 0 || v > 100_000_000) return { error: "Enter an amount like 250." };
  const ok = await saveSettingsRow(supabase, { rto_amount: v });
  if (!ok) return { error: "That did not save. Try again." };
  refresh();
  return { ok: true };
}

export async function setNotifCapture(on: boolean): Promise<FormState> {
  const supabase = await requireAuthed();
  const ok = await saveSettingsRow(supabase, { notif_capture_enabled: on === true });
  if (!ok) return { error: "That did not save. Try again." };
  refresh();
  return { ok: true };
}

export async function deleteRule(id: string): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!UUID.test(id)) return { error: "That rule was not found." };
  const { error } = await supabase.from("merchant_rules").delete().eq("id", id);
  if (error) return { error: "Could not delete that rule. Try again." };
  refresh();
  return { ok: true };
}
