"use server";

import { revalidatePath } from "next/cache";
import { requireAuthed } from "@/lib/auth/require";
import type { FormState } from "@/lib/form-state";
import { validateRule, validateSource, type RuleInput, type SourceInput } from "@/lib/capture/validate";
import { MAX_PATTERNS, validatePattern, type PatternInput } from "@/lib/capture/patterns";
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

/** Saves how one source (GCash, Maya, BPI...) is captured. */
export async function saveCaptureSource(input: SourceInput): Promise<FormState> {
  const supabase = await requireAuthed();
  const v = validateSource(input);
  if (!v.ok) return { error: v.error };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sign in again." };
  if (v.value.accountId) {
    const a = await supabase.from("accounts").select("id").eq("id", v.value.accountId).is("archived_at", null).maybeSingle();
    if (!a.data) return { error: "That account was not found." };
  }
  if (v.value.categoryId) {
    const c = await supabase.from("categories").select("id").eq("id", v.value.categoryId).is("archived_at", null).maybeSingle();
    if (!c.data) return { error: "That category was not found." };
  }
  const { error } = await supabase.from("capture_sources").upsert(
    {
      user_id: auth.user.id,
      source: v.value.source,
      enabled: v.value.enabled,
      packages: v.value.packages,
      senders: v.value.senders,
      account_id: v.value.accountId,
      category_id: v.value.categoryId,
      auto_confirm: v.value.autoConfirm,
      min_amount: v.value.minAmount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,source" },
  );
  if (error) return { error: "That did not save. Try again." };
  refresh();
  return { ok: true };
}

/** Adds a keyword rule: when a notification or email contains these words, ignore it, file it, or confirm it. */
export async function addCaptureRule(input: RuleInput): Promise<FormState> {
  const supabase = await requireAuthed();
  const v = validateRule(input);
  if (!v.ok) return { error: v.error };
  if (v.value.categoryId) {
    const c = await supabase.from("categories").select("id").eq("id", v.value.categoryId).is("archived_at", null).maybeSingle();
    if (!c.data) return { error: "That category was not found." };
  }
  const { error } = await supabase.from("capture_rules").insert({ source: v.value.source, match_text: v.value.matchText, action: v.value.action, category_id: v.value.categoryId });
  if (error) return { error: "Could not add that rule. Try again." };
  refresh();
  return { ok: true };
}

/** Adds a notification pattern you wrote: wording with {amount}, {name}, {last4}, {ref}, {any}. The phone turns it into a regex. */
export async function addCapturePattern(input: PatternInput): Promise<FormState> {
  const supabase = await requireAuthed();
  const v = validatePattern(input);
  if (!v.ok) return { error: v.error };
  const count = await supabase.from("capture_patterns").select("id", { count: "exact", head: true });
  if ((count.count ?? 0) >= MAX_PATTERNS) return { error: `Up to ${MAX_PATTERNS} patterns. Delete one first.` };
  const { error } = await supabase.from("capture_patterns").insert({ source: v.value.source, template: v.value.template, direction: v.value.direction });
  if (error) return { error: ["42P01", "PGRST205"].includes(error.code) ? "Apply the capture_patterns database update first." : "Could not add that pattern. Try again." };
  refresh();
  return { ok: true };
}

export async function deleteCapturePattern(id: string): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!UUID.test(id)) return { error: "That pattern was not found." };
  const { error } = await supabase.from("capture_patterns").delete().eq("id", id);
  if (error) return { error: "Could not delete that pattern. Try again." };
  refresh();
  return { ok: true };
}

export async function deleteCaptureRule(id: string): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!UUID.test(id)) return { error: "That rule was not found." };
  const { error } = await supabase.from("capture_rules").delete().eq("id", id);
  if (error) return { error: "Could not delete that rule. Try again." };
  refresh();
  return { ok: true };
}
