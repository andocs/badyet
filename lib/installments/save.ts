import type { SupabaseClient } from '@supabase/supabase-js';
import type { IsoDate } from '@/lib/domain/dates';
import { financedAmount, paymentAmounts, schedule } from '@/lib/domain/instalments';
import { money } from '@/lib/domain/money';
import { validateInstallment } from './input';

export type Result = { ok: true } | { error: string };

export const INSTALLMENTS_CATEGORY = 'Installments';

/** The Installments category every plan's line sits in; made inside Essentials (or the first group) the first time. */
async function ensureCategory(supabase: SupabaseClient): Promise<string | null> {
  const found = await supabase.from('categories').select('id').eq('name', INSTALLMENTS_CATEGORY).is('archived_at', null).limit(1).maybeSingle();
  if (found.data?.id) return found.data.id as string;
  const groups = await supabase.from('category_groups').select('id, name').is('archived_at', null).order('sort');
  const list = (groups.data ?? []) as { id: string; name: string }[];
  const group = list.find((g) => g.name.toLowerCase() === 'essentials') ?? list[0];
  if (!group) return null;
  const made = await supabase.from('categories').insert({ group_id: group.id, name: INSTALLMENTS_CATEGORY, sort: 90 }).select('id').single();
  return (made.data?.id as string | undefined) ?? null;
}

const monthStart = (d: string) => `${d.slice(0, 7)}-01`;

/**
 * Saves a plan and keeps its budget line in step: one fixed line for the monthly payment, in the chosen cutoff, from the first due month
 * to the last. Editing a plan updates that line; deleting the plan removes it. The same code runs on the web and the phone.
 */
export async function saveInstallment(supabase: SupabaseClient, input: unknown): Promise<Result> {
  const v = validateInstallment(input);
  if (!v.ok) return { error: v.error };
  const p = v.value;

  if (p.accountId) {
    const acct = await supabase.from('accounts').select('id').eq('id', p.accountId).is('archived_at', null).maybeSingle();
    if (!acct.data) return { error: 'That account was not found.' };
  }
  const facts = { price: money(p.price), downPayment: money(p.downPayment), termCount: p.termCount, rateBp: p.rateBp > 0 ? p.rateBp : null, firstDueOn: p.firstDueOn as IsoDate };
  if (financedAmount(facts) <= 0) return { error: 'The down payment has to be less than the price.' };
  const rows = schedule(facts);
  const payment = paymentAmounts(facts)[0]!;
  const lastMonth = rows[rows.length - 1]!.dueOn;

  const planValues = {
    name: p.name, kind: p.kind, price: p.price, down_payment: p.downPayment, term_count: p.termCount, rate_bp: p.rateBp,
    first_due_on: p.firstDueOn, cutoff: p.cutoff, account_id: p.accountId,
  };
  let planId = p.id ?? null;
  if (planId) {
    const { data, error } = await supabase.from('installment_plans').update(planValues).eq('id', planId).select('id');
    if (error) return { error: 'Could not save the plan. Try again.' };
    if (!data || data.length === 0) return { error: 'That plan was not found.' };
  } else {
    const { data, error } = await supabase.from('installment_plans').insert(planValues).select('id').single();
    if (error || !data) return { error: 'Could not save the plan. Try again.' };
    planId = data.id as string;
  }

  const lineValues = {
    name: p.name, rule: 'fixed', amount: payment, pct_bp: null, cutoff: p.cutoff, account_id: p.accountId,
    starts_on: monthStart(p.firstDueOn), ends_on: monthStart(lastMonth), is_draft: false, counts_to_daily: false, kind: 'normal',
    source: 'installment', source_id: planId,
  };
  const line = await supabase.from('budget_lines_v2').select('id').eq('source', 'installment').eq('source_id', planId).maybeSingle();
  if (line.data) {
    const { error } = await supabase.from('budget_lines_v2').update(lineValues).eq('id', line.data.id);
    if (error) return { error: 'Saved the plan but not its budget line. Try again.' };
  } else {
    const category = await ensureCategory(supabase);
    if (!category) return { error: 'Saved the plan, but there is no budget group to put its line in. Add one in Budget first.' };
    const { error } = await supabase.from('budget_lines_v2').insert({ ...lineValues, category_id: category, sort: 90 });
    if (error) return { error: 'Saved the plan but not its budget line. Try again.' };
  }
  return { ok: true };
}

/** Deletes a plan and its budget line. Spending that was already recorded stays. */
export async function deleteInstallment(supabase: SupabaseClient, id: string): Promise<Result> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: 'That plan was not found.' };
  const line = await supabase.from('budget_lines_v2').delete().eq('source', 'installment').eq('source_id', id);
  if (line.error) return { error: 'Could not delete the plan. Try again.' };
  const { error } = await supabase.from('installment_plans').delete().eq('id', id);
  return error ? { error: 'Could not delete the plan. Try again.' } : { ok: true };
}

export interface PlanRow {
  id: string;
  name: string;
  kind: 'card' | 'loan';
  price: number;
  down_payment: number;
  term_count: number;
  rate_bp: number;
  first_due_on: string;
  cutoff: 'first' | 'second';
  account_id: string | null;
}

export async function loadInstallments(supabase: SupabaseClient): Promise<{ plans: PlanRow[]; missing: boolean }> {
  const r = await supabase.from('installment_plans').select('id, name, kind, price, down_payment, term_count, rate_bp, first_due_on, cutoff, account_id').order('first_due_on');
  if (r.error) {
    if (r.error.code === '42P01' || r.error.code === 'PGRST205') return { plans: [], missing: true };
    throw r.error;
  }
  return { plans: (r.data ?? []) as PlanRow[], missing: false };
}
