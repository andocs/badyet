import type { SupabaseClient } from '@supabase/supabase-js';
import { configsFromRows, defaultConfig, rulesFromRows, SOURCES, type CaptureRule, type RuleRow, type SourceConfig, type SourceRow } from '@/lib/capture/sources';
import { validateRule, validateSource, type RuleInput, type SourceInput } from '@/lib/capture/validate';

export interface CaptureData {
  configs: SourceConfig[];
  rules: CaptureRule[];
  /** The capture tables are not in the database yet (migration not applied). */
  missing: boolean;
}

export type Result = { ok: true } | { error: string };

// A missing table shows up as Postgres 42P01 directly, or as PGRST205 through the API.
const isMissingTable = (e: { code?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205');

export async function loadCapture(supabase: SupabaseClient): Promise<CaptureData> {
  const [src, rul] = await Promise.all([
    supabase.from('capture_sources').select('source, enabled, packages, senders, account_id, category_id, auto_confirm, min_amount'),
    supabase.from('capture_rules').select('id, source, match_text, action, category_id').order('created_at'),
  ]);
  if (isMissingTable(src.error) || isMissingTable(rul.error)) return { configs: SOURCES.map(defaultConfig), rules: [], missing: true };
  if (src.error) throw src.error;
  if (rul.error) throw rul.error;
  return { configs: configsFromRows((src.data ?? []) as SourceRow[]), rules: rulesFromRows((rul.data ?? []) as RuleRow[]), missing: false };
}

/** Same checks as the web: the account and category must exist and not be archived. */
async function exists(supabase: SupabaseClient, table: 'accounts' | 'categories', id: string | null): Promise<boolean> {
  if (!id) return true;
  const r = await supabase.from(table).select('id').eq('id', id).is('archived_at', null).maybeSingle();
  return !!r.data;
}

export async function saveSource(supabase: SupabaseClient, userId: string, input: SourceInput): Promise<Result> {
  const v = validateSource(input);
  if (!v.ok) return { error: v.error };
  if (!(await exists(supabase, 'accounts', v.value.accountId))) return { error: 'That account was not found.' };
  if (!(await exists(supabase, 'categories', v.value.categoryId))) return { error: 'That category was not found.' };
  const { error } = await supabase.from('capture_sources').upsert(
    {
      user_id: userId,
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
    { onConflict: 'user_id,source' },
  );
  return error ? { error: 'That did not save. Try again.' } : { ok: true };
}

export async function addRule(supabase: SupabaseClient, input: RuleInput): Promise<Result> {
  const v = validateRule(input);
  if (!v.ok) return { error: v.error };
  if (!(await exists(supabase, 'categories', v.value.categoryId))) return { error: 'That category was not found.' };
  const { error } = await supabase.from('capture_rules').insert({ source: v.value.source, match_text: v.value.matchText, action: v.value.action, category_id: v.value.categoryId });
  return error ? { error: 'Could not add that rule. Try again.' } : { ok: true };
}

export async function removeRule(supabase: SupabaseClient, id: string): Promise<Result> {
  const { error } = await supabase.from('capture_rules').delete().eq('id', id);
  return error ? { error: 'Could not delete that rule. Try again.' } : { ok: true };
}
