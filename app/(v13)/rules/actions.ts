"use server";

import { revalidatePath } from "next/cache";
import { requireAuthed } from "@/lib/auth/require";
import type { FormState } from "@/lib/form-state";
import { ruleFullRow, validateRuleFull, type RuleFullInput } from "@/lib/capture/validate";
import { reorder, validateDedupe, type DedupeInput } from "@/lib/rules/helpers";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refresh = () => {
  for (const p of ["/rules", "/settings", "/inbox"]) revalidatePath(p);
};
const MISSING = ["42703", "42P01", "PGRST204", "PGRST205"];

/** Saves one rule from the Rules page: a new one (id null) goes to the bottom of the list. */
export async function saveCaptureRuleFull(id: string | null, input: RuleFullInput): Promise<FormState> {
  const supabase = await requireAuthed();
  if (id !== null && !UUID.test(id)) return { error: "That rule was not found." };
  const v = validateRuleFull(input);
  if (!v.ok) return { error: v.error };
  for (const accountId of [v.value.fromAccountId, v.value.toAccountId]) {
    if (!accountId) continue;
    const a = await supabase.from("accounts").select("id").eq("id", accountId).is("archived_at", null).maybeSingle();
    if (!a.data) return { error: "That account was not found." };
  }
  if (v.value.categoryId) {
    const c = await supabase.from("categories").select("id").eq("id", v.value.categoryId).is("archived_at", null).maybeSingle();
    if (!c.data) return { error: "That category was not found." };
  }
  const row = { ...ruleFullRow(v.value), source: null };
  if (id === null) {
    const last = await supabase.from("capture_rules").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
    if (last.error) return { error: MISSING.includes(last.error.code) ? "Apply the Rules database update first." : "That did not save. Try again." };
    const position = ((last.data as { position: number } | null)?.position ?? -1) + 1;
    const { error } = await supabase.from("capture_rules").insert({ ...row, position });
    if (error) return { error: "That did not save. Try again." };
  } else {
    const { error } = await supabase.from("capture_rules").update(row).eq("id", id);
    if (error) return { error: MISSING.includes(error.code) ? "Apply the Rules database update first." : "That did not save. Try again." };
  }
  refresh();
  return { ok: true };
}

export async function setRuleEnabled(id: string, enabled: boolean): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!UUID.test(id)) return { error: "That rule was not found." };
  const { error } = await supabase.from("capture_rules").update({ enabled: enabled === true }).eq("id", id);
  if (error) return { error: "That did not save. Try again." };
  refresh();
  return { ok: true };
}

/** Moves a rule one place up or down by renumbering `position` top to bottom. */
export async function moveRule(id: string, dir: "up" | "down"): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!UUID.test(id) || (dir !== "up" && dir !== "down")) return { error: "That rule was not found." };
  const { data, error } = await supabase.from("capture_rules").select("id, position").order("position").order("created_at");
  if (error) return { error: "Could not move that rule. Try again." };
  const rows = (data ?? []) as { id: string; position: number }[];
  const next = reorder(rows.map((r) => r.id), id, dir);
  if (!next) return { ok: true };
  const was = new Map(rows.map((r) => [r.id, r.position]));
  for (const [position, rid] of next.entries()) {
    if (was.get(rid) === position) continue;
    const { error: e } = await supabase.from("capture_rules").update({ position }).eq("id", rid);
    if (e) return { error: "Could not move that rule. Try again." };
  }
  refresh();
  return { ok: true };
}

/** The duplicate rule: one row per person. */
export async function saveDedupeRule(input: DedupeInput): Promise<FormState> {
  const supabase = await requireAuthed();
  const v = validateDedupe(input);
  if (!v.ok) return { error: v.error };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sign in again." };
  const { error } = await supabase.from("dedupe_rules").upsert(
    { user_id: auth.user.id, window_minutes: v.value.windowMinutes, match_source: v.value.matchSource, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) return { error: MISSING.includes(error.code) ? "Apply the dedupe_rules database update first." : "That did not save. Try again." };
  refresh();
  return { ok: true };
}
