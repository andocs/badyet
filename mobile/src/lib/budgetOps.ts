import type { SupabaseClient } from '@supabase/supabase-js';
import { validateCategory } from '@/lib/budget/line-input';

export type Result = { ok: true } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SETTLE_KINDS = ['settle_to_pool', 'settle_to_wants', 'settle_to_savings', 'over_from_wants', 'over_from_excess'];

/** Creates or edits a category. Same rules as the web action. */
export async function saveCategory(supabase: SupabaseClient, input: unknown): Promise<Result> {
  const v = validateCategory(input);
  if (!v.ok) return { error: v.error };
  const c = v.value;
  const group = await supabase.from('category_groups').select('id').eq('id', c.groupId).maybeSingle();
  if (!group.data) return { error: 'That group was not found.' };
  const values = { name: c.name, group_id: c.groupId, color: c.color };
  const { error } = c.id ? await supabase.from('categories').update(values).eq('id', c.id) : await supabase.from('categories').insert(values);
  return error ? { error: 'Could not save the category. Try again.' } : { ok: true };
}

/** Archives a category: it keeps its transactions but leaves the pickers. A category that still has lines cannot be archived. */
export async function archiveCategory(supabase: SupabaseClient, id: string): Promise<Result> {
  if (!UUID.test(id)) return { error: 'That category was not found.' };
  const used = await supabase.from('budget_lines_v2').select('id', { count: 'exact', head: true }).eq('category_id', id);
  if ((used.count ?? 0) > 0) return { error: 'Move or delete its budget lines first.' };
  const { error } = await supabase.from('categories').update({ archived_at: new Date().toISOString() }).eq('id', id);
  return error ? { error: 'Could not archive that. Try again.' } : { ok: true };
}

/** The weekdays you usually go to the office (ISO, 1 = Monday). */
export async function setUsualOfficeDays(supabase: SupabaseClient, days: number[]): Promise<Result> {
  if (!Array.isArray(days) || days.length > 7 || days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return { error: 'Pick days of the week.' };
  const unique = [...new Set(days)].sort();
  const existing = await supabase.from('user_settings').select('user_id').maybeSingle();
  const { error } = existing.data
    ? await supabase.from('user_settings').update({ office_days: unique }).eq('user_id', existing.data.user_id)
    : await supabase.from('user_settings').insert({ office_days: unique });
  return error ? { error: 'Could not save that. Try again.' } : { ok: true };
}

/** Mark a day as an office day (or not). Going in on a non-usual day draws one day's budget from the contingency pool. */
export async function setOfficeDay(supabase: SupabaseClient, input: { date: string; office: boolean; usual: boolean; dayBudget: number }): Promise<Result> {
  if (!DAY.test(input.date)) return { error: 'Pick a day.' };
  if (!Number.isInteger(input.dayBudget) || input.dayBudget < 0 || input.dayBudget > 100_000_000) return { error: 'Check the day budget.' };
  const wantsOverride = input.office !== input.usual;
  const [pool, contingency] = await Promise.all([
    supabase.from('pools').select('id, budget_line_id').not('budget_line_id', 'is', null),
    supabase.from('budget_lines_v2').select('id').eq('kind', 'rto_contingency').is('plan_id', null).maybeSingle(),
    supabase.from('office_day_overrides').delete().eq('day', input.date),
  ]);
  const poolId = ((pool.data ?? []) as { id: string; budget_line_id: string }[]).find((p) => p.budget_line_id === (contingency.data as { id: string } | null)?.id)?.id;
  const [, , ins] = await Promise.all([
    poolId ? supabase.from('pool_entries').delete().eq('pool_id', poolId).eq('occurred_on', input.date).eq('kind', 'use').eq('note', 'Extra office day') : Promise.resolve(null),
    poolId ? supabase.from('pool_entries').delete().eq('pool_id', poolId).eq('occurred_on', input.date).in('kind', SETTLE_KINDS) : Promise.resolve(null),
    wantsOverride ? supabase.from('office_day_overrides').insert({ day: input.date, in_office: input.office }) : Promise.resolve(null),
  ]);
  if (ins?.error) return { error: 'Could not save that day. Try again.' };
  if (wantsOverride && input.office && !input.usual && poolId && input.dayBudget > 0) {
    await supabase.from('pool_entries').insert({ pool_id: poolId, occurred_on: input.date, kind: 'use', amount: input.dayBudget, note: 'Extra office day' });
  }
  return { ok: true };
}

/** Where an office day's difference goes: under budget to the pool or Wants, over budget from Wants or the pool's excess. */
export async function settleDay(supabase: SupabaseClient, input: { date: string; under: boolean; to: 'pool' | 'wants' | 'savings' | 'excess'; amount: number }): Promise<Result> {
  if (!DAY.test(input.date)) return { error: 'Pick a day.' };
  if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > 100_000_000) return { error: 'Check the amount.' };
  const kind = input.under
    ? input.to === 'pool' ? 'settle_to_pool' : input.to === 'wants' ? 'settle_to_wants' : input.to === 'savings' ? 'settle_to_savings' : null
    : input.to === 'wants' ? 'over_from_wants' : input.to === 'excess' ? 'over_from_excess' : null;
  if (!kind) return { error: 'Pick where it goes.' };
  const contingency = await supabase.from('budget_lines_v2').select('id').eq('kind', 'rto_contingency').is('plan_id', null).maybeSingle();
  const pool = contingency.data ? await supabase.from('pools').select('id').eq('budget_line_id', (contingency.data as { id: string }).id).maybeSingle() : { data: null };
  if (!pool.data) return { error: 'Mark one budget line as the RTO contingency first.' };
  const poolId = (pool.data as { id: string }).id;
  await supabase.from('pool_entries').delete().eq('pool_id', poolId).eq('occurred_on', input.date).in('kind', SETTLE_KINDS);
  const { error } = await supabase.from('pool_entries').insert({ pool_id: poolId, occurred_on: input.date, kind, amount: input.amount, note: 'Office day settled' });
  return error ? { error: 'Could not save that. Try again.' } : { ok: true };
}

export async function undoSettle(supabase: SupabaseClient, date: string): Promise<Result> {
  if (!DAY.test(date)) return { error: 'Pick a day.' };
  const { error } = await supabase.from('pool_entries').delete().eq('occurred_on', date).in('kind', SETTLE_KINDS);
  return error ? { error: 'Could not undo that. Try again.' } : { ok: true };
}

/** Take money out of a pool for something unplanned, or move it to Wants (which adds to this cutoff's daily amount). */
export async function takeFromPool(supabase: SupabaseClient, input: { poolId: string; amount: number; to: 'use' | 'to_wants'; note?: string }): Promise<Result> {
  if (!UUID.test(input.poolId)) return { error: 'That pool was not found.' };
  if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > 100_000_000_000) return { error: 'Enter an amount above zero.' };
  if (input.to !== 'use' && input.to !== 'to_wants') return { error: 'Pick what to do.' };
  const pool = await supabase.from('pools').select('id').eq('id', input.poolId).maybeSingle();
  if (!pool.data) return { error: 'That pool was not found.' };
  const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
  const note = (input.note ?? (input.to === 'use' ? 'Used for something unplanned' : 'Moved to Wants')).slice(0, 200);
  const { error } = await supabase.from('pool_entries').insert({ pool_id: input.poolId, occurred_on: today, kind: input.to, amount: input.amount, note });
  return error ? { error: 'Could not save that. Try again.' } : { ok: true };
}

/** A new pool, optionally funded each cutoff by a budget line, with an optional "keep up to" level. */
export async function createPool(supabase: SupabaseClient, input: { name: string; lineId: string | null; keepUpTo: number | null }): Promise<Result> {
  const name = (input.name ?? '').trim();
  if (name.length < 1 || name.length > 40) return { error: 'Give the pool a name of up to 40 characters.' };
  if (input.lineId !== null && !UUID.test(input.lineId)) return { error: 'Pick a line from the list.' };
  if (input.keepUpTo !== null && (!Number.isInteger(input.keepUpTo) || input.keepUpTo < 0)) return { error: 'Check the keep-up-to amount.' };
  const { error } = await supabase.from('pools').insert({ name, budget_line_id: input.lineId, keep_up_to: input.keepUpTo });
  return error ? { error: 'Could not create the pool. Try again.' } : { ok: true };
}
