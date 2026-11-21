import type { SupabaseClient } from '@supabase/supabase-js';

export type Result = { ok: true } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An expected event has happened: it becomes a confirmed one. */
export async function confirmEvent(supabase: SupabaseClient, id: string): Promise<Result> {
  if (!UUID.test(id)) return { error: 'That event was not found.' };
  const { error } = await supabase.from('salary_events').update({ status: 'confirmed' }).eq('id', id);
  return error ? { error: 'Could not confirm that. Try again.' } : { ok: true };
}

/** Removes an event. Its "where the extra goes" top-ups go with it. The start event is your base and stays. */
export async function deleteEvent(supabase: SupabaseClient, id: string): Promise<Result> {
  if (!UUID.test(id)) return { error: 'That event was not found.' };
  const row = await supabase.from('salary_events').select('kind').eq('id', id).maybeSingle();
  if (!row.data) return { error: 'That event was not found.' };
  if (row.data.kind === 'start') return { error: 'The start event is your base pay. Add a raise instead of removing it.' };
  const { error } = await supabase.from('salary_events').delete().eq('id', id);
  return error ? { error: 'Could not remove that. Try again.' } : { ok: true };
}

/** The "Assume a raise every year" card: on or off, the percent (basis points), and the month. */
export async function saveAssumptions(supabase: SupabaseClient, input: { on: boolean; pctBp: number; month: number }): Promise<Result> {
  if (!Number.isInteger(input.pctBp) || input.pctBp < 0 || input.pctBp > 100_000) return { error: 'Enter a raise between 0% and 1,000%.' };
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) return { error: 'Pick a month.' };
  const values = { assumed_raise_on: input.on === true, assumed_raise_bp: input.pctBp, assumed_raise_month: input.month };
  const existing = await supabase.from('plan_assumptions').select('user_id').maybeSingle();
  const { error } = existing.data
    ? await supabase.from('plan_assumptions').update(values).eq('user_id', existing.data.user_id)
    : await supabase.from('plan_assumptions').insert(values);
  return error ? { error: 'Could not save that. Try again.' } : { ok: true };
}

export async function setAllowance(supabase: SupabaseClient, id: string, change: { cutoff?: 'first' | 'second'; taxable?: boolean }): Promise<Result> {
  if (!UUID.test(id)) return { error: 'That allowance was not found.' };
  const values: Record<string, unknown> = {};
  if (change.cutoff === 'first' || change.cutoff === 'second') values.payslip_cutoff = change.cutoff;
  if (typeof change.taxable === 'boolean') values.taxable = change.taxable;
  if (Object.keys(values).length === 0) return { error: 'Nothing to change.' };
  const { error } = await supabase.from('allowances').update(values).eq('id', id);
  return error ? { error: 'Could not save that. Try again.' } : { ok: true };
}

export async function deleteAllowance(supabase: SupabaseClient, id: string): Promise<Result> {
  if (!UUID.test(id)) return { error: 'That allowance was not found.' };
  const { error } = await supabase.from('allowances').delete().eq('id', id);
  return error ? { error: 'Could not remove that. Try again.' } : { ok: true };
}
