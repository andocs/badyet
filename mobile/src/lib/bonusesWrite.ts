import type { SupabaseClient } from '@supabase/supabase-js';
import { validateInstance } from '@/lib/bonuses/input';

export type Result = { ok: true } | { error: string };

/**
 * Saves one year's choices for a bonus: the CIP Low/Base/High pick, where the money goes (replacing the earlier list, with done ticks),
 * and, when it has been paid, what actually arrived. Same checks and writes as the web action.
 */
export async function saveInstance(supabase: SupabaseClient, input: unknown): Promise<Result> {
  const v = validateInstance(input);
  if (!v.ok) return { error: v.error };
  const i = v.value;

  const rule = await supabase.from('bonus_rules').select('id').eq('id', i.ruleId).maybeSingle();
  if (!rule.data) return { error: 'That bonus was not found.' };

  const values = {
    multiplier_num: i.multiplierNum,
    ...(i.received
      ? { status: 'received', gross_actual: i.received.gross, de_minimis_actual: i.received.deMinimis, net_actual: i.received.net, tax_actual: i.received.gross - i.received.net }
      : {}),
  };
  const existing = await supabase.from('bonus_instances').select('id').eq('rule_id', i.ruleId).eq('year', i.year).maybeSingle();
  let instanceId = existing.data?.id as string | undefined;
  if (instanceId) {
    const { error } = await supabase.from('bonus_instances').update(values).eq('id', instanceId);
    if (error) return { error: 'Could not save that. Try again.' };
  } else {
    const { data, error } = await supabase.from('bonus_instances').insert({ rule_id: i.ruleId, year: i.year, status: 'planned', ...values }).select('id').single();
    if (error || !data) return { error: 'Could not save that. Try again.' };
    instanceId = data.id as string;
  }

  const del = await supabase.from('bonus_instance_splits').delete().eq('instance_id', instanceId);
  if (del.error) return { error: 'Could not save the destinations. Try again.' };
  if (i.splits.length > 0) {
    const ins = await supabase
      .from('bonus_instance_splits')
      .insert(i.splits.map((s) => ({ instance_id: instanceId, target_kind: s.kind, target_id: s.targetId, label: s.label, amount: s.amount, done: s.done })));
    if (ins.error) return { error: 'Saved the bonus but not its destinations. Try again.' };
  }
  return { ok: true };
}
