import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The payroll savings plan: money your employer takes from each payslip into savings. It lowers take-home (it is a payslip deduction)
 * and, when it names a fund, the forecast counts it as saved into that fund, without taking it out of the budget a second time.
 */
export interface SavingsPlanInput {
  mode: 'off' | 'percent' | 'amount';
  /** Basis points of basic pay per cutoff, for `percent` (1% = 100). */
  percentBp: number | null;
  /** Centavos per cutoff, for `amount`. */
  amount: number | null;
  fundId: string | null;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };
export type Result = { ok: true } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const int = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

export function validateSavingsPlan(input: unknown): Checked<SavingsPlanInput> {
  if (typeof input !== 'object' || input === null) return { ok: false, error: 'Nothing to save.' };
  const p = input as Record<string, unknown>;
  if (p.mode !== 'off' && p.mode !== 'percent' && p.mode !== 'amount') return { ok: false, error: 'Pick off, a percent or an amount.' };
  const fundId = p.fundId == null || p.fundId === '' ? null : p.fundId;
  if (fundId !== null && (typeof fundId !== 'string' || !UUID.test(fundId))) return { ok: false, error: 'Pick a fund from the list.' };
  if (p.mode === 'off') return { ok: true, value: { mode: 'off', percentBp: null, amount: null, fundId: null } };
  if (p.mode === 'percent') {
    if (!int(p.percentBp, 1, 10_000)) return { ok: false, error: 'The percent of your basic pay is more than 0 and up to 100.' };
    return { ok: true, value: { mode: 'percent', percentBp: p.percentBp, amount: null, fundId } };
  }
  if (!int(p.amount, 1, 10_000_000_000)) return { ok: false, error: 'Enter the amount taken each cutoff, like 2,000.' };
  return { ok: true, value: { mode: 'amount', percentBp: null, amount: p.amount, fundId } };
}

/** Saves the plan to your pay settings (creating them if they do not exist yet). The web and the phone share this. */
export async function saveSavingsPlan(supabase: SupabaseClient, input: unknown): Promise<Result> {
  const v = validateSavingsPlan(input);
  if (!v.ok) return { error: v.error };
  const p = v.value;
  if (p.fundId) {
    const fund = await supabase.from('funds').select('id').eq('id', p.fundId).is('archived_at', null).maybeSingle();
    if (!fund.data) return { error: 'That fund was not found.' };
  }
  const values = {
    savings_plan_bp: p.mode === 'percent' ? p.percentBp : 0,
    savings_plan_amount: p.mode === 'amount' ? p.amount : null,
    savings_plan_fund_id: p.fundId,
  };
  const existing = await supabase.from('pay_settings').select('user_id').maybeSingle();
  const { error } = existing.data ? await supabase.from('pay_settings').update(values).eq('user_id', existing.data.user_id) : await supabase.from('pay_settings').insert(values);
  if (error) return { error: error.code === '42703' ? 'Apply the savings plan database update first, then try again.' : 'Could not save that. Try again.' };
  return { ok: true };
}

/** From a fund editor's input: true = this fund should get the payroll savings plan, false = it should not, null = not asked. */
export function planLinkChoice(input: unknown): boolean | null {
  const v = (input as { linkPlan?: unknown } | null)?.linkPlan;
  return typeof v === 'boolean' ? v : null;
}

/**
 * Makes a fund the one the payroll savings plan feeds, or stops it feeding it. Only one fund can have it: choosing another moves it,
 * and turning it off on a fund that does not have it changes nothing.
 */
export async function linkPlanFund(supabase: SupabaseClient, fundId: string, linked: boolean): Promise<Result> {
  if (!UUID.test(fundId)) return { error: 'That fund was not found.' };
  const existing = await supabase.from('pay_settings').select('user_id, savings_plan_fund_id').maybeSingle();
  if (existing.error) return { error: existing.error.code === '42703' ? 'Apply the savings plan database update first, then try again.' : 'Could not link the savings plan. Try again.' };
  const current = (existing.data as { savings_plan_fund_id: string | null } | null)?.savings_plan_fund_id ?? null;
  if (!linked && current !== fundId) return { ok: true };
  const value = linked ? fundId : null;
  const r = existing.data ? await supabase.from('pay_settings').update({ savings_plan_fund_id: value }).eq('user_id', (existing.data as { user_id: string }).user_id) : await supabase.from('pay_settings').insert({ savings_plan_fund_id: value });
  return r.error ? { error: 'Could not link the savings plan. Try again.' } : { ok: true };
}
