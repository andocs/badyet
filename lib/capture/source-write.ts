import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultConfig, isSource, type SourceRow } from "./sources";

export type SourceResult = { ok: true } | { error: string };

/**
 * Removes a source from the Rules list, or adds it back. Removing also turns it off, so the phone stops listening; adding it back
 * turns it on with the settings it had. The built-in reader is never deleted.
 */
export async function setSourceRemoved(supabase: SupabaseClient, source: string, removed: boolean): Promise<SourceResult> {
  if (!isSource(source)) return { error: "That source was not found." };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sign in again." };
  const existing = await supabase.from("capture_sources").select("source").eq("source", source).maybeSingle();
  if (existing.error) return { error: "That did not save. Try again." };
  const d = defaultConfig(source);
  const r = existing.data
    ? await supabase.from("capture_sources").update({ removed, enabled: !removed, updated_at: new Date().toISOString() }).eq("source", source)
    : await supabase.from("capture_sources").insert({
        user_id: auth.user.id, source, enabled: !removed, removed, packages: d.packages, senders: d.senders, account_id: null, category_id: null, auto_confirm: false, min_amount: 0,
      });
  if (r.error) return { error: r.error.code === "42703" ? "Apply the rev-38 database update first (20261220000000_source_removed.sql)." : "That did not save. Try again." };
  return { ok: true };
}

/** Lays the rev-38 "removed" flag over saved source rows. Asked for on its own so a database without that update still loads. */
export async function withRemoved(supabase: SupabaseClient, rows: SourceRow[]): Promise<SourceRow[]> {
  const r = await supabase.from("capture_sources").select("source, removed, label");
  if (r.error) return rows;
  const extra = new Map(((r.data ?? []) as { source: string; removed: boolean; label: string | null }[]).map((x) => [x.source, x]));
  return rows.map((row) => ({ ...row, removed: extra.get(row.source)?.removed ?? false, label: extra.get(row.source)?.label ?? null }));
}
