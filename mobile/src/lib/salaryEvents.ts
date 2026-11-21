import type { SupabaseClient } from '@supabase/supabase-js';
import { validateRaise, validateTemplates } from '@/lib/salary/event-input';

export type Result = { ok: true } | { error: string };

const firstOf = (month: string) => `${month}-01`;

/** The raise wizard's save: the event, an allowance when that is what changed, and the "where the extra goes" top-ups. Same rules as the web action. */
export async function addSalaryEvent(supabase: SupabaseClient, input: unknown): Promise<Result> {
  const v = validateRaise(input);
  if (!v.ok) return { error: v.error };
  const p = v.value;

  if (p.allocations.length > 0) {
    const ids = p.allocations.map((a) => a.lineId);
    const found = await supabase.from('budget_lines_v2').select('id').in('id', ids);
    if ((found.data ?? []).length !== ids.length) return { error: 'One of those budget lines was not found.' };
  }

  let allowanceId: string | null = null;
  if (p.kind === 'allowance' && p.allowance) {
    const a = p.allowance;
    const made = await supabase
      .from('allowances')
      .insert({ payslip_cutoff: a.cutoff, name: a.name, amount: a.amount, frequency: a.frequency, pay_month: a.frequency === 'yearly' ? a.payMonth : null, taxable: a.taxable, starts_on: firstOf(p.month) })
      .select('id')
      .single();
    if (made.error || !made.data) return { error: 'Could not save the allowance. Try again.' };
    allowanceId = (made.data as { id: string }).id;
  }

  const event = await supabase
    .from('salary_events')
    .insert({
      effective_month: firstOf(p.month),
      kind: p.kind,
      pct_bp: p.pctBp ?? null,
      new_base: p.newBase ?? null,
      allowance_id: allowanceId,
      one_off_amount: p.adjustment?.amount ?? null,
      one_off_taxable: p.adjustment?.taxable ?? false,
      title: p.title ?? null,
      grade: p.grade ?? null,
      status: p.status,
    })
    .select('id')
    .single();
  if (event.error || !event.data) {
    if (allowanceId) await supabase.from('allowances').delete().eq('id', allowanceId);
    return { error: 'Could not save the event. Try again.' };
  }
  const eventId = (event.data as { id: string }).id;

  if (p.allocations.length > 0) {
    const ins = await supabase.from('raise_allocations').insert(
      p.allocations.map((a) => ({ salary_event_id: eventId, budget_line_id: a.lineId, mode: a.mode, amount: a.mode === 'amount' ? a.amount : null, pct_bp: a.mode === 'percent' ? a.pctBp : null })),
    );
    if (ins.error) return { error: 'The event was saved but its budget top-ups were not. Edit them from Budget.' };
  }
  return { ok: true };
}

/** Saves the payslip layout from a month on: one template per cutoff, replacing any saved for that same month. */
export async function saveTemplates(supabase: SupabaseClient, input: unknown): Promise<Result> {
  const v = validateTemplates(input);
  if (!v.ok) return { error: v.error };
  const { month, first, second } = v.value;
  const del = await supabase.from('payslip_templates').delete().eq('effective_month', firstOf(month));
  if (del.error) return { error: 'Could not save the layout. Try again.' };
  const made = await supabase
    .from('payslip_templates')
    .insert([
      { cutoff: 'first', effective_month: firstOf(month) },
      { cutoff: 'second', effective_month: firstOf(month) },
    ])
    .select('id, cutoff');
  if (made.error || !made.data) return { error: 'Could not save the layout. Try again.' };
  const rows = (made.data as { id: string; cutoff: string }[]).flatMap((t) =>
    (t.cutoff === 'first' ? first : second).map((l, i) => ({
      template_id: t.id,
      kind: l.kind,
      label: l.label,
      source: l.source,
      share_bp: l.shareBp ?? null,
      amount_override: l.amountOverride ?? null,
      sort: i,
    })),
  );
  if (rows.length > 0) {
    const ins = await supabase.from('payslip_lines').insert(rows);
    if (ins.error) return { error: 'Saved the layout but not its lines. Try again.' };
  }
  return { ok: true };
}

/** Back to the standard layout from a month on: layouts saved for that month and later are removed. */
export async function resetTemplates(supabase: SupabaseClient, month: string): Promise<Result> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { error: 'Pick a month.' };
  const { error } = await supabase.from('payslip_templates').delete().gte('effective_month', firstOf(month));
  return error ? { error: 'Could not reset the layout. Try again.' } : { ok: true };
}
