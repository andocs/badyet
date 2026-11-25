import type { SupabaseClient } from '@supabase/supabase-js';
import { parsePesos } from '@/lib/domain/money';

/**
 * A payroll deduction that is not one of the necessary ones (tax, SSS, PhilHealth, Pag-IBIG, PenBoost): your HMO plan, for example.
 * It comes off every cutoff, shows in its own section on the payslip, and is listed on the Budget page without being part of the
 * planned total, since it is already out of your take-home.
 */
export interface OtherDeductionInput {
  /** What it is called, such as "HMO plan". Empty = "Other deduction". */
  label: string;
  /** Pesos as typed, taken every cutoff. Empty or 0 turns it off. */
  amount: string;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };
export type Result = { ok: true } | { error: string };

export function validateOtherDeduction(input: unknown): Checked<{ label: string | null; amount: number }> {
  if (typeof input !== 'object' || input === null) return { ok: false, error: 'Nothing to save.' };
  const i = input as Record<string, unknown>;
  const label = (typeof i.label === 'string' ? i.label : '').trim().replace(/\s+/g, ' ');
  if (label.length > 30) return { ok: false, error: 'Keep the name under 30 characters.' };
  const typed = (typeof i.amount === 'string' ? i.amount : '').trim();
  const amount = typed === '' ? 0 : parsePesos(typed);
  if (amount === undefined || amount < 0 || amount > 10_000_000_000) return { ok: false, error: 'Enter the amount taken each cutoff, like 1,200.' };
  return { ok: true, value: { label: label === '' ? null : label, amount } };
}

/** Saves the deduction to your pay settings (creating them if they do not exist yet). The web and the phone share this. */
export async function saveOtherDeduction(supabase: SupabaseClient, input: unknown): Promise<Result> {
  const v = validateOtherDeduction(input);
  if (!v.ok) return { error: v.error };
  const values = { other_deduction: v.value.amount, other_deduction_label: v.value.label };
  const existing = await supabase.from('pay_settings').select('user_id').maybeSingle();
  const { error } = existing.data ? await supabase.from('pay_settings').update(values).eq('user_id', existing.data.user_id) : await supabase.from('pay_settings').insert(values);
  if (error) return { error: error.code === '42703' ? 'Apply the payroll labels database update first, then try again.' : 'Could not save that. Try again.' };
  return { ok: true };
}
