import type { SupabaseClient } from '@supabase/supabase-js';
import { patternsFromRows, validatePattern, type CapturePattern, type PatternInput, type PatternRow, MAX_PATTERNS } from '@/lib/capture/patterns';
import { configsFromRows, defaultConfig, rulesFromRows, SOURCES, type CaptureRule, type RuleRow, type SourceConfig, type SourceRow } from '@/lib/capture/sources';
import { DEFAULT_DEDUPE, type DedupeRule } from '@/lib/capture/recent';
import { validateRule, validateSource, type RuleInput, type SourceInput } from '@/lib/capture/validate';

export interface CaptureData {
  configs: SourceConfig[];
  rules: CaptureRule[];
  /** Notification wordings you wrote yourself. */
  patterns: CapturePattern[];
  /** When a notification and an email are the same movement. */
  dedupe: DedupeRule;
  /** The capture tables are not in the database yet (migration not applied). */
  missing: boolean;
}

export type Result = { ok: true } | { error: string };

// A missing table shows up as Postgres 42P01 directly, or as PGRST205 through the API.
const isMissingTable = (e: { code?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205');

export async function loadCapture(supabase: SupabaseClient): Promise<CaptureData> {
  const [src, rul, pat, ded] = await Promise.all([
    supabase.from('capture_sources').select('source, enabled, packages, senders, account_id, category_id, auto_confirm, min_amount'),
    supabase.from('capture_rules').select('id, source, match_text, action, category_id').order('created_at'),
    supabase.from('capture_patterns').select('id, source, template, direction').order('created_at'),
    supabase.from('dedupe_rules').select('window_minutes, match_source').maybeSingle(),
  ]);
  if (isMissingTable(src.error) || isMissingTable(rul.error)) return { configs: SOURCES.map(defaultConfig), rules: [], patterns: [], dedupe: DEFAULT_DEDUPE, missing: true };
  if (src.error) throw src.error;
  if (rul.error) throw rul.error;
  // Patterns come from a newer migration; until it is applied everything else keeps working.
  const patterns = pat.error ? [] : patternsFromRows((pat.data ?? []) as PatternRow[]);
  // Also from a newer migration: no row, or no table yet, means the defaults.
  const dedupe: DedupeRule = ded.data ? { windowMin: ded.data.window_minutes, matchSource: ded.data.match_source } : DEFAULT_DEDUPE;
  return { configs: configsFromRows((src.data ?? []) as SourceRow[]), rules: rulesFromRows((rul.data ?? []) as RuleRow[]), patterns, dedupe, missing: false };
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

export async function addPattern(supabase: SupabaseClient, input: PatternInput, existing: number): Promise<Result> {
  const v = validatePattern(input);
  if (!v.ok) return { error: v.error };
  if (existing >= MAX_PATTERNS) return { error: `Up to ${MAX_PATTERNS} patterns. Delete one first.` };
  const { error } = await supabase.from('capture_patterns').insert({ source: v.value.source, template: v.value.template, direction: v.value.direction });
  if (error) return { error: isMissingTable(error) ? 'Apply the capture_patterns database update first.' : 'Could not add that pattern. Try again.' };
  return { ok: true };
}

export async function removePattern(supabase: SupabaseClient, id: string): Promise<Result> {
  const { error } = await supabase.from('capture_patterns').delete().eq('id', id);
  return error ? { error: 'Could not delete that pattern. Try again.' } : { ok: true };
}

export async function removeRule(supabase: SupabaseClient, id: string): Promise<Result> {
  const { error } = await supabase.from('capture_rules').delete().eq('id', id);
  return error ? { error: 'Could not delete that rule. Try again.' } : { ok: true };
}
