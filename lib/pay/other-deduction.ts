import type { SupabaseClient } from '@supabase/supabase-js';
import { parsePesos } from '@/lib/domain/money';
import type { PaySettings } from '@/lib/engine/types';

/**
 * Payroll deductions that are not the necessary ones (tax, SSS, PhilHealth, Pag-IBIG, PenBoost): an HMO plan, a loan, and so on.
 * Each one is on the 1st cutoff, the 2nd, or both (with its own amount in the 2nd when it differs). They show in their own section
 * on the payslip and are listed on the Budget page without being part of the planned total, since they are already out of take-home.
 */
export interface OtherDeductionDraft {
  /** What it is called, such as "HMO plan". Empty = "Other deduction". */
  label: string;
  cutoff: 'first' | 'second' | 'both';
  /** Pesos as typed: the amount in the 1st cutoff (or the only cutoff it is on). */
  amount: string;
  /** Pesos as typed, only when it is on both cutoffs: the 2nd cutoff's amount. Empty = the same as the 1st. */
  amountSecond: string;
  /** The budget line it shows under on the Budget page (an id), or empty for none. */
  lineId: string;
}

/** What is stored: centavos. */
export interface StoredOtherDeduction {
  label: string;
  cutoff: 'first' | 'second' | 'both';
  amount: number;
  amountSecond: number | null;
  lineId: string | null;
}

export const MAX_OTHER_DEDUCTIONS = 8;

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };
export type Result = { ok: true } | { error: string };

const pesos = (c: number) => (c / 100).toFixed(2);

/** The rows to edit: your list, or the single deduction you had before the list existed. */
export function otherDeductionDrafts(settings: Pick<PaySettings, 'otherDeduction' | 'otherDeductionLabel' | 'otherDeductions'>): OtherDeductionDraft[] {
  const list = settings.otherDeductions ?? [];
  if (list.length > 0) return list.map((o) => ({ label: o.label, cutoff: o.cutoff, amount: pesos(o.amount), amountSecond: o.amountSecond === null ? '' : pesos(o.amountSecond), lineId: o.lineId ?? '' }));
  if (settings.otherDeduction > 0) return [{ label: settings.otherDeductionLabel ?? '', cutoff: 'both', amount: pesos(settings.otherDeduction), amountSecond: '', lineId: '' }];
  return [];
}

export function validateOtherDeductions(input: unknown): Checked<StoredOtherDeduction[]> {
  const rows = (input as { items?: unknown } | null)?.items;
  if (!Array.isArray(rows)) return { ok: false, error: 'Nothing to save.' };
  if (rows.length > MAX_OTHER_DEDUCTIONS) return { ok: false, error: `Keep it to ${MAX_OTHER_DEDUCTIONS} deductions.` };
  const out: StoredOtherDeduction[] = [];
  for (const raw of rows) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const label = (typeof r.label === 'string' ? r.label : '').trim().replace(/\s+/g, ' ');
    const typed = (typeof r.amount === 'string' ? r.amount : '').trim();
    const typed2 = (typeof r.amountSecond === 'string' ? r.amountSecond : '').trim();
    // A row with nothing typed is an empty row, not a mistake.
    if (label === '' && typed === '' && typed2 === '') continue;
    if (label.length > 30) return { ok: false, error: 'Keep each name under 30 characters.' };
    const cutoff = r.cutoff === 'first' || r.cutoff === 'second' ? r.cutoff : 'both';
    const name = label === '' ? 'this deduction' : label;
    const amount = typed === '' ? undefined : parsePesos(typed);
    if (amount === undefined || amount <= 0 || amount > 10_000_000_000) return { ok: false, error: `Enter how much ${name} takes, like 1,200.` };
    let amountSecond: number | null = null;
    if (cutoff === 'both' && typed2 !== '') {
      const v = parsePesos(typed2);
      if (v === undefined || v < 0 || v > 10_000_000_000) return { ok: false, error: `Enter the 2nd cutoff amount for ${name}, like 1,200, or leave it empty to use the same amount.` };
      amountSecond = v;
    }
    const lineId = typeof r.lineId === 'string' && r.lineId !== '' ? r.lineId : null;
    if (lineId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lineId)) return { ok: false, error: `Pick a budget line from the list for ${name}.` };
    out.push({ label, cutoff, amount, amountSecond, lineId });
  }
  return { ok: true, value: out };
}

/** Saves the list to your pay settings (creating them if they do not exist yet). The web and the phone share this. */
export async function saveOtherDeductions(supabase: SupabaseClient, input: unknown): Promise<Result> {
  const v = validateOtherDeductions(input);
  if (!v.ok) return { error: v.error };
  // The old single deduction is cleared so it is not counted on top of the list.
  const values = { other_deductions: v.value, other_deduction: 0 };
  const existing = await supabase.from('pay_settings').select('user_id').maybeSingle();
  const { error } = existing.data ? await supabase.from('pay_settings').update(values).eq('user_id', existing.data.user_id) : await supabase.from('pay_settings').insert(values);
  if (error) return { error: error.code === '42703' ? 'Apply the other deductions database update first, then try again.' : 'Could not save that. Try again.' };
  return { ok: true };
}
