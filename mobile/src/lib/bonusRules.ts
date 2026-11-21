import type { SupabaseClient } from '@supabase/supabase-js';
import { validateRule } from '@/lib/bonuses/input';

export type Result = { ok: true } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Creates or updates a bonus rule (yearly, or a one-off). Same rules as the web action. */
export async function saveRule(supabase: SupabaseClient, input: unknown): Promise<Result> {
  const v = validateRule(input);
  if (!v.ok) return { error: v.error };
  const r = v.value;
  const values = {
    payslip_cutoff: r.cutoff,
    recurrence: r.recurrence,
    kind: r.kind,
    name: r.name,
    pay_month: r.payMonth,
    once_on: r.recurrence === 'once' && r.onceOn ? `${r.onceOn}-01` : null,
    formula: r.formula,
    base_multiple_bp: r.formula === 'base_multiple' ? r.baseMultipleBp : null,
    eligible_amount: r.formula === 'eligible_x_component_x_multiplier' ? r.eligibleAmount : null,
    component_num: r.formula === 'eligible_x_component_x_multiplier' ? r.componentNum : null,
    fixed_amount: r.formula === 'fixed' ? r.fixedAmount : null,
    de_minimis: r.deMinimis,
  };
  const { error } = r.id ? await supabase.from('bonus_rules').update(values).eq('id', r.id) : await supabase.from('bonus_rules').insert(values);
  return error ? { error: 'Could not save the bonus. Try again.' } : { ok: true };
}

/** Removes a bonus from every future plan. Years it was received keep their history, so it is archived, not deleted. */
export async function archiveRule(supabase: SupabaseClient, id: string): Promise<Result> {
  if (!UUID.test(id)) return { error: 'That bonus was not found.' };
  const { error } = await supabase.from('bonus_rules').update({ archived_at: new Date().toISOString() }).eq('id', id);
  return error ? { error: 'Could not remove that. Try again.' } : { ok: true };
}
