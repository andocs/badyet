import type { SupabaseClient } from '@supabase/supabase-js';
import type { YearMonth } from '@/lib/domain/dates';
import { money } from '@/lib/domain/money';
import type { PayCutoff, PayslipEdit } from '@/lib/engine/types';

/**
 * "This month only" on the payslip builder: a line's amount changed for one month, leaving the saved layout alone. The web and the
 * phone share this.
 */
export type Result = { ok: true } | { error: string };
export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const SOURCES = ['income_tax', 'sss', 'philhealth', 'pagibig', 'penboost', 'custom'] as const;
type EditSource = (typeof SOURCES)[number];

/** A line as the builder holds it. */
export interface BuilderLine {
  kind: 'earning' | 'deduction';
  label: string;
  source: string;
  shareBp?: number | null;
  amountOverride?: number | null;
}
export type BuilderLayout = Record<PayCutoff, readonly BuilderLine[]>;

export interface EditChange {
  cutoff: PayCutoff;
  source: EditSource;
  label: string;
  /** Centavos, or null for the calculated amount. */
  amount: number | null;
}

/** Which line an edit belongs to. Your own lines are told apart by name; the others there is one of per cutoff. */
export const editKey = (l: { cutoff: PayCutoff; source: string; label: string }): string => (l.source === 'custom' ? `${l.cutoff}|custom|${l.label}` : `${l.cutoff}|${l.source}`);

const shape = (lines: readonly BuilderLine[]) => JSON.stringify(lines.map((l) => [l.kind, l.source, l.label, l.shareBp ?? null]));

/** The lines whose typed amount differs between the saved layout and what is on screen. */
export function changedKeys(saved: BuilderLayout, now: BuilderLayout): Set<string> {
  const out = new Set<string>();
  for (const cutoff of ['first', 'second'] as const) {
    for (const l of now[cutoff]) {
      const was = saved[cutoff].find((x) => x.source === l.source && (l.source !== 'custom' || x.label === l.label));
      if (was && (was.amountOverride ?? null) !== (l.amountOverride ?? null)) out.add(editKey({ cutoff, source: l.source, label: l.label }));
    }
  }
  return out;
}

/** What "This month only" would save: the changed amounts. Changes to the layout itself cannot be for one month. */
export function monthChanges(saved: BuilderLayout, now: BuilderLayout): Checked<EditChange[]> {
  for (const cutoff of ['first', 'second'] as const) {
    if (shape(saved[cutoff]) !== shape(now[cutoff])) return { ok: false, error: 'Only amounts can change for one month. Moving, adding or removing a line, or changing a share, is saved from this month on.' };
  }
  const keys = changedKeys(saved, now);
  const out: EditChange[] = [];
  for (const cutoff of ['first', 'second'] as const) {
    for (const l of now[cutoff]) {
      if (!keys.has(editKey({ cutoff, source: l.source, label: l.label }))) continue;
      if (!(SOURCES as readonly string[]).includes(l.source)) return { ok: false, error: `${l.label} cannot be changed for one month.` };
      out.push({ cutoff, source: l.source as EditSource, label: l.label, amount: l.amountOverride ?? null });
    }
  }
  return out.length > 0 ? { ok: true, value: out } : { ok: false, error: 'Change an amount first, then choose This month only.' };
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const isLine = (x: unknown): x is { cutoff: PayCutoff; source: EditSource; label: string } => {
  const l = x as { cutoff?: unknown; source?: unknown; label?: unknown } | null;
  return !!l && (l.cutoff === 'first' || l.cutoff === 'second') && (SOURCES as readonly string[]).includes(l.source as string) && typeof l.label === 'string' && l.label.length >= 1 && l.label.length <= 60;
};
const missing = (code: string | undefined) => code === '42P01' || code === 'PGRST205';
const APPLY = 'Apply the "this month only" database update first, then try again.';

export async function saveMonthEdits(supabase: SupabaseClient, input: unknown): Promise<Result> {
  const i = input as { month?: unknown; edits?: unknown } | null;
  if (!i || typeof i.month !== 'string' || !MONTH.test(i.month) || !Array.isArray(i.edits) || i.edits.length < 1 || i.edits.length > 40) return { error: 'Nothing to save.' };
  const month = `${i.month}-01`;
  const rows: Record<string, unknown>[] = [];
  for (const e of i.edits) {
    const amount = (e as { amount?: unknown }).amount ?? null;
    if (!isLine(e) || (amount !== null && (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0 || amount > 10_000_000_000))) return { error: 'Check the amounts.' };
    rows.push({ month, cutoff: e.cutoff, source: e.source, label: e.label, amount });
  }
  const { error } = await supabase.from('payslip_month_edits').upsert(rows, { onConflict: 'user_id,month,cutoff,source,label' });
  return error ? { error: missing(error.code) ? APPLY : 'Could not save that. Try again.' } : { ok: true };
}

/** Removes this month's change from the lines named. A table that is not there yet has nothing to remove. */
export async function removeMonthEdits(supabase: SupabaseClient, input: unknown): Promise<Result> {
  const i = input as { month?: unknown; lines?: unknown } | null;
  if (!i || typeof i.month !== 'string' || !MONTH.test(i.month) || !Array.isArray(i.lines) || !i.lines.every(isLine)) return { error: 'Nothing to remove.' };
  for (const l of i.lines) {
    let q = supabase.from('payslip_month_edits').delete().eq('month', `${i.month}-01`).eq('cutoff', l.cutoff).eq('source', l.source);
    if (l.source === 'custom') q = q.eq('label', l.label);
    const { error } = await q;
    if (error && !missing(error.code)) return { error: 'Could not remove that. Try again.' };
  }
  return { ok: true };
}

/** The stored rows as the engine reads them. */
export const monthEditsOf = (rows: readonly { month: string; cutoff: PayCutoff; source: string; label: string; amount: number | null }[]): PayslipEdit[] =>
  rows.map((r) => ({ month: r.month.slice(0, 7) as YearMonth, cutoff: r.cutoff, source: r.source, label: r.label, amount: r.amount === null ? null : money(r.amount) }));
