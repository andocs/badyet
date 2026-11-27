import type { SupabaseClient } from '@supabase/supabase-js';
import type { RuleRow } from './sources';

/**
 * "Others" on a capture rule: whose account the money arrives in, when it is not one of yours. The column is newer than the rest of
 * the rule, so it is read and cleared on its own and a database without that update keeps all its rules working.
 */
export async function withRuleOthers(supabase: SupabaseClient, rows: RuleRow[]): Promise<RuleRow[]> {
  if (rows.length === 0) return rows;
  const r = await supabase.from('capture_rules').select('id, to_other').not('to_other', 'is', null);
  if (r.error) return rows;
  const owners = new Map(((r.data ?? []) as { id: string; to_other: string }[]).map((x) => [x.id, x.to_other]));
  return rows.map((x) => (owners.has(x.id) ? { ...x, to_other: owners.get(x.id)! } : x));
}

/** After saving a rule that no longer names someone else's account. An error only means the column is not there yet. */
export async function clearRuleOther(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from('capture_rules').update({ to_other: null }).eq('id', id);
}
