import type { SupabaseClient } from '@supabase/supabase-js';
import { validateLine } from '@/lib/budget/line-input';

export type Result = { ok: true } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const monthStart = (m: string | null) => (m ? `${m}-01` : null);

/** Creates or updates a budget line. Only one line can be the RTO contingency; choosing another moves the role. Same rules as the web action. */
export async function saveLine(supabase: SupabaseClient, input: unknown): Promise<Result> {
  const v = validateLine(input);
  if (!v.ok) return { error: v.error };
  const l = v.value;

  const cat = await supabase.from('categories').select('id').eq('id', l.categoryId).is('archived_at', null).maybeSingle();
  if (!cat.data) return { error: 'That category was not found.' };
  if (l.accountId) {
    const acct = await supabase.from('accounts').select('id').eq('id', l.accountId).maybeSingle();
    if (!acct.data) return { error: 'That account was not found.' };
  }
  if (l.kind === 'rto_contingency') {
    // The database allows one contingency line; free the role first so the save below cannot trip it.
    const q = supabase.from('budget_lines_v2').update({ kind: 'normal' }).eq('kind', 'rto_contingency');
    await (l.id ? q.neq('id', l.id) : q);
  }

  const values = {
    category_id: l.categoryId,
    name: l.name,
    rule: l.rule,
    amount: l.rule === 'fixed' ? l.amount : null,
    pct_bp: l.rule === 'pct' ? l.pctBp : null,
    cutoff: l.cutoff,
    account_id: l.accountId,
    starts_on: monthStart(l.startsOn),
    ends_on: monthStart(l.endsOn),
    is_draft: l.isDraft,
    counts_to_daily: l.countsToDaily,
    kind: l.kind,
  };
  let lineId = l.id ?? null;
  if (l.id) {
    const { error } = await supabase.from('budget_lines_v2').update(values).eq('id', l.id);
    if (error) return { error: 'Could not save the line. Try again.' };
  } else {
    const { data, error } = await supabase.from('budget_lines_v2').insert(values).select('id').single();
    if (error || !data) return { error: 'Could not save the line. Try again.' };
    lineId = data.id as string;
  }

  // The contingency line funds a pool of the same name; create it the first time.
  if (l.kind === 'rto_contingency' && lineId) {
    const pool = await supabase.from('pools').select('id').eq('budget_line_id', lineId).maybeSingle();
    if (!pool.data) await supabase.from('pools').insert({ name: 'RTO contingency', budget_line_id: lineId });
  }
  return { ok: true };
}

/** Deletes a line. Transactions that pointed at it stay (they lose the link); raise top-ups on it go. */
export async function deleteLine(supabase: SupabaseClient, id: string): Promise<Result> {
  if (!UUID.test(id)) return { error: 'That line was not found.' };
  const { error } = await supabase.from('budget_lines_v2').delete().eq('id', id);
  return error ? { error: 'Could not delete that line. Try again.' } : { ok: true };
}
