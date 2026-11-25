import { linkPlanFund, planLinkChoice } from '@/lib/pay/savings-plan';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateFund, validateOverride } from '@/lib/funds/input';

export type Result = { ok: true } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Creates or updates a fund. A new fund goes last in the default priority. Same rules as the web action. */
export async function saveFund(supabase: SupabaseClient, input: unknown): Promise<Result> {
  const v = validateFund(input);
  if (!v.ok) return { error: v.error };
  const f = v.value;
  if (f.linkedAccountId) {
    const acct = await supabase.from('accounts').select('id').eq('id', f.linkedAccountId).maybeSingle();
    if (!acct.data) return { error: 'That account was not found.' };
  }
  const values = {
    name: f.name, color: f.color, rule: f.rule, target: f.target, tranches: f.tranches, max_per_month: f.maxPerMonth, fixed_amount: f.fixedAmount,
    reset_month: f.resetMonth, linked_account_id: f.linkedAccountId, share_bp: f.shareBp, start_balance: f.startBalance,
  };
  let fundId = f.id ?? null;
  if (f.id) {
    const { error } = await supabase.from('funds').update(values).eq('id', f.id);
    if (error) return { error: 'Could not save the fund. Try again.' };
  } else {
    const last = await supabase.from('funds').select('priority').is('archived_at', null).order('priority', { ascending: false }).limit(1).maybeSingle();
    const ins = await supabase.from('funds').insert({ ...values, priority: ((last.data as { priority?: number } | null)?.priority ?? 0) + 1 }).select('id').single();
    if (ins.error || !ins.data) return { error: 'Could not save the fund. Try again.' };
    fundId = (ins.data as { id: string }).id;
  }
  // "The payroll savings plan goes into this fund": only one fund can have it.
  const link = planLinkChoice(input);
  if (link !== null && fundId) {
    const r = await linkPlanFund(supabase, fundId, link);
    if ('error' in r) return { error: 'The fund was saved, but ' + r.error.charAt(0).toLowerCase() + r.error.slice(1) };
  }
  return { ok: true };
}

/** Archives a fund: it leaves the forecast. */
export async function archiveFund(supabase: SupabaseClient, id: string): Promise<Result> {
  if (!UUID.test(id)) return { error: 'That fund was not found.' };
  const { error } = await supabase.from('funds').update({ archived_at: new Date().toISOString() }).eq('id', id);
  return error ? { error: 'Could not archive that. Try again.' } : { ok: true };
}

/** The default priority: the funds in the order given (first is filled first). */
export async function reorderFunds(supabase: SupabaseClient, ids: string[]): Promise<Result> {
  if (!Array.isArray(ids) || ids.length > 50 || !ids.every((i) => UUID.test(i))) return { error: 'Check the order.' };
  for (const [i, id] of ids.entries()) {
    const { error } = await supabase.from('funds').update({ priority: i + 1 }).eq('id', id);
    if (error) return { error: 'Could not save the order. Try again.' };
  }
  return { ok: true };
}

interface Plan {
  order: string[] | null;
  pins: Record<string, number>;
  skips: string[];
  note: string | null;
}

/** Writes one month's override, replacing what was there. An empty override removes the month's row. */
async function writeOverride(supabase: SupabaseClient, month: string, plan: Plan): Promise<string | null> {
  const first = `${month}-01`;
  const existing = await supabase.from('month_overrides').select('id').eq('month', first).maybeSingle();
  const empty = !plan.order && Object.keys(plan.pins).length === 0 && plan.skips.length === 0;
  if (empty) {
    if (existing.data) await supabase.from('month_overrides').delete().eq('id', (existing.data as { id: string }).id);
    return null;
  }
  let id = (existing.data as { id: string } | null)?.id;
  if (id) {
    const { error } = await supabase.from('month_overrides').update({ fund_order: plan.order, note: plan.note }).eq('id', id);
    if (error) return 'Could not save that month.';
    await supabase.from('month_fund_overrides').delete().eq('override_id', id);
  } else {
    const { data, error } = await supabase.from('month_overrides').insert({ month: first, fund_order: plan.order, note: plan.note }).select('id').single();
    if (error || !data) return 'Could not save that month.';
    id = (data as { id: string }).id;
  }
  const rows = [
    ...Object.entries(plan.pins).map(([fund_id, pin_amount]) => ({ override_id: id, fund_id, pin_amount, skip: false })),
    ...plan.skips.map((fund_id) => ({ override_id: id, fund_id, pin_amount: null, skip: true })),
  ];
  if (rows.length > 0) {
    const { error } = await supabase.from('month_fund_overrides').insert(rows);
    if (error) return 'Saved the month but not its pins and skips.';
  }
  return null;
}

/** Override one or more months with the same order, pins and skips. Funds must be your own. */
export async function saveOverride(supabase: SupabaseClient, input: unknown): Promise<Result> {
  const v = validateOverride(input);
  if (!v.ok) return { error: v.error };
  const o = v.value;
  const ids = [...new Set([...(o.order ?? []), ...Object.keys(o.pins), ...o.skips])];
  if (ids.length > 0) {
    const found = await supabase.from('funds').select('id').in('id', ids);
    if ((found.data ?? []).length !== ids.length) return { error: 'One of those funds was not found.' };
  }
  for (const month of o.months) {
    const err = await writeOverride(supabase, month, { order: o.order, pins: o.pins, skips: o.skips, note: o.note });
    if (err) return { error: err };
  }
  return { ok: true };
}

/** Back to the default for these months. */
export async function resetMonths(supabase: SupabaseClient, months: string[]): Promise<Result> {
  if (!Array.isArray(months) || months.length < 1 || months.length > 60 || !months.every((m) => MONTH.test(m))) return { error: 'Pick the months.' };
  const { error } = await supabase.from('month_overrides').delete().in('month', months.map((m) => `${m}-01`));
  return error ? { error: 'Could not reset that. Try again.' } : { ok: true };
}

/** Bulk change: put a fund first, pin an amount for it, or skip it, in every selected month, keeping whatever else each month already had. */
export async function bulkOverride(supabase: SupabaseClient, input: { months: string[]; op: 'first' | 'pin' | 'skip' | 'unpin'; fundId: string; amount?: number }): Promise<Result> {
  if (!Array.isArray(input.months) || input.months.length < 1 || input.months.length > 60 || !input.months.every((m) => MONTH.test(m))) return { error: 'Pick the months.' };
  if (!UUID.test(input.fundId)) return { error: 'Pick a fund.' };
  if (!['first', 'pin', 'skip', 'unpin'].includes(input.op)) return { error: 'Pick what to do.' };
  if (input.op === 'pin' && (!Number.isInteger(input.amount) || (input.amount as number) < 0 || (input.amount as number) > 100_000_000_000)) return { error: 'Enter the amount to pin.' };

  const fundRows = await supabase.from('funds').select('id').is('archived_at', null).order('priority');
  const defaultOrder = ((fundRows.data ?? []) as { id: string }[]).map((f) => f.id);
  if (!defaultOrder.includes(input.fundId)) return { error: 'That fund was not found.' };

  for (const month of input.months) {
    const ov = await supabase.from('month_overrides').select('id, fund_order, note').eq('month', `${month}-01`).maybeSingle();
    const row = ov.data as { id: string; fund_order: string[] | null; note: string | null } | null;
    const pinRows = row
      ? await supabase.from('month_fund_overrides').select('fund_id, pin_amount, skip').eq('override_id', row.id)
      : { data: [] as { fund_id: string; pin_amount: number | null; skip: boolean }[] };
    const pins: Record<string, number> = {};
    const skips: string[] = [];
    for (const r of (pinRows.data ?? []) as { fund_id: string; pin_amount: number | null; skip: boolean }[]) {
      if (r.skip) skips.push(r.fund_id);
      else if (r.pin_amount !== null) pins[r.fund_id] = r.pin_amount;
    }
    let order = row?.fund_order ?? null;
    if (input.op === 'first') order = [input.fundId, ...(order ?? defaultOrder).filter((id) => id !== input.fundId)];
    if (input.op === 'pin') {
      pins[input.fundId] = input.amount as number;
      const i = skips.indexOf(input.fundId);
      if (i >= 0) skips.splice(i, 1);
    }
    if (input.op === 'skip') {
      delete pins[input.fundId];
      if (!skips.includes(input.fundId)) skips.push(input.fundId);
    }
    if (input.op === 'unpin') {
      delete pins[input.fundId];
      const i = skips.indexOf(input.fundId);
      if (i >= 0) skips.splice(i, 1);
    }
    const err = await writeOverride(supabase, month, { order, pins, skips, note: row?.note ?? null });
    if (err) return { error: err };
  }
  return { ok: true };
}
