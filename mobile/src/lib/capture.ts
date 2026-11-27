import { withRemoved } from '@/lib/capture/source-write';
import type { SupabaseClient } from '@supabase/supabase-js';
import { patternsFromRows, validatePattern, type CapturePattern, type PatternInput, type PatternRow, MAX_PATTERNS } from '@/lib/capture/patterns';
import { clearRuleOther, withRuleOthers } from '@/lib/capture/rule-other';
import { configsFromRows, defaultConfig, rulesFromRows, SOURCES, type CaptureRule, type RuleRow, type SourceConfig, type SourceRow } from '@/lib/capture/sources';
import { DEFAULT_DEDUPE, type DedupeRule } from '@/lib/capture/recent';
import { ruleFullRow, validateRule, validateRuleFull, validateSource, type RuleFullInput, type RuleInput, type SourceInput } from '@/lib/capture/validate';

export interface CaptureData {
  configs: SourceConfig[];
  rules: CaptureRule[];
  /** Notification wordings you wrote yourself. */
  patterns: CapturePattern[];
  /** When a notification and an email are the same movement. */
  dedupe: DedupeRule;
  /** Check Gmail as soon as the Gmail app shows a notification. */
  gmailAlert: boolean;
  /** The capture tables are not in the database yet (migration not applied). */
  missing: boolean;
}

export type Result = { ok: true } | { error: string };

// A missing table shows up as Postgres 42P01 directly, or as PGRST205 through the API.
const isMissingTable = (e: { code?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205');

const RULE_COLUMNS_OLD = 'id, source, match_text, action, category_id';
const RULE_COLUMNS = `${RULE_COLUMNS_OLD}, name, enabled, channel, words, must_words, skip_words, sources, packages, senders, kind, from_account_id, to_account_id, auto_confirm, position`;

/** Rules in order (position, then created). A database without the Rules page migration (42703 undefined column) keeps working on the old columns. */
async function selectRules(supabase: SupabaseClient) {
  const full = await supabase.from('capture_rules').select(RULE_COLUMNS).order('position').order('created_at');
  if (full.error?.code !== '42703') return full;
  return supabase.from('capture_rules').select(RULE_COLUMNS_OLD).order('created_at');
}

export async function loadCapture(supabase: SupabaseClient): Promise<CaptureData> {
  const [src, rul, pat, ded, set] = await Promise.all([
    supabase.from('capture_sources').select('source, enabled, packages, senders, account_id, category_id, auto_confirm, min_amount'),
    selectRules(supabase),
    supabase.from('capture_patterns').select('id, source, template, direction').order('created_at'),
    supabase.from('dedupe_rules').select('window_minutes, match_source').maybeSingle(),
    supabase.from('user_settings').select('gmail_alert_check').maybeSingle(),
  ]);
  if (isMissingTable(src.error) || isMissingTable(rul.error)) return { configs: SOURCES.map(defaultConfig), rules: [], patterns: [], dedupe: DEFAULT_DEDUPE, gmailAlert: true, missing: true };
  if (src.error) throw src.error;
  if (rul.error) throw rul.error;
  // Patterns come from a newer migration; until it is applied everything else keeps working.
  const patterns = pat.error ? [] : patternsFromRows((pat.data ?? []) as PatternRow[]);
  // Also from a newer migration: no row, or no table yet, means the defaults.
  const dedupe: DedupeRule = ded.data ? { windowMin: ded.data.window_minutes, matchSource: ded.data.match_source } : DEFAULT_DEDUPE;
  return { configs: configsFromRows(await withRemoved(supabase, (src.data ?? []) as SourceRow[])), rules: rulesFromRows(await withRuleOthers(supabase, (rul.data ?? []) as RuleRow[])), patterns, dedupe, gmailAlert: set.data?.gmail_alert_check ?? true, missing: false };
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
      label: v.value.label,
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

export const deleteRule = removeRule;

/** Saves a Rules page rule: a new one at the bottom of the list (id null) or an edit of an existing one. */
export async function saveRuleFull(supabase: SupabaseClient, id: string | null, input: RuleFullInput): Promise<Result> {
  const v = validateRuleFull(input);
  if (!v.ok) return { error: v.error };
  if (!(await exists(supabase, 'categories', v.value.categoryId))) return { error: 'That category was not found.' };
  if (!(await exists(supabase, 'accounts', v.value.fromAccountId)) || !(await exists(supabase, 'accounts', v.value.toAccountId))) return { error: 'That account was not found.' };
  const row = ruleFullRow(v.value);
  if (id) {
    const { error } = await supabase.from('capture_rules').update(row).eq('id', id);
    if (error) return { error: 'That did not save. Try again.' };
    if (!v.value.toOther) await clearRuleOther(supabase, id);
    return { ok: true };
  }
  const last = await supabase.from('capture_rules').select('position').order('position', { ascending: false }).limit(1).maybeSingle();
  const position = ((last.data as { position?: number } | null)?.position ?? -1) + 1;
  const { error } = await supabase.from('capture_rules').insert({ ...row, position });
  return error ? { error: 'That did not save. Try again.' } : { ok: true };
}

export async function setRuleEnabled(supabase: SupabaseClient, id: string, enabled: boolean): Promise<Result> {
  const { error } = await supabase.from('capture_rules').update({ enabled }).eq('id', id);
  return error ? { error: 'That did not save. Try again.' } : { ok: true };
}

/** Moves a rule one place up (-1) or down (1) by swapping with its neighbour; positions are renumbered 0..n so old rows that all sit at 0 still order. */
export async function moveRule(supabase: SupabaseClient, ordered: readonly { id: string; position?: number }[], id: string, direction: -1 | 1): Promise<Result> {
  const from = ordered.findIndex((r) => r.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ordered.length) return { ok: true };
  const next = ordered.map((r) => r.id);
  [next[from], next[to]] = [next[to]!, next[from]!];
  const changed = next.map((rid, position) => ({ rid, position })).filter((x) => ordered.find((r) => r.id === x.rid)?.position !== x.position);
  const results = await Promise.all(changed.map((x) => supabase.from('capture_rules').update({ position: x.position }).eq('id', x.rid)));
  return results.some((r) => r.error) ? { error: 'Could not move that rule. Try again.' } : { ok: true };
}

/** The one duplicate rule (a row per user). Window is 1 to 240 minutes. */
export async function saveDedupeRule(supabase: SupabaseClient, userId: string, rule: DedupeRule): Promise<Result> {
  if (!Number.isInteger(rule.windowMin) || rule.windowMin < 1 || rule.windowMin > 240) return { error: 'The window is 1 minute to 4 hours.' };
  const { error } = await supabase.from('dedupe_rules').upsert({ user_id: userId, window_minutes: rule.windowMin, match_source: rule.matchSource }, { onConflict: 'user_id' });
  return error ? { error: 'That did not save. Try again.' } : { ok: true };
}

/** Turns "check Gmail when Gmail notifies" on or off (the first save creates your settings row). */
export async function saveGmailAlert(supabase: SupabaseClient, userId: string, on: boolean): Promise<Result> {
  const { error } = await supabase.from('user_settings').upsert({ user_id: userId, gmail_alert_check: on, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  return error ? { error: 'That did not save. Try again.' } : { ok: true };
}
