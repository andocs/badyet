import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { deleteLine, saveLine } from './budgetWrite';

const CAT = '33333333-3333-4333-8333-333333333333';
const ACC = '22222222-2222-4222-8222-222222222222';
const LINE = '44444444-4444-4444-8444-444444444444';

type Answer = { data?: unknown; error?: unknown };
type Op = { name: string; args: unknown[] };

/** Stand-in client: every query ends in `answers["table:op"]` (op = insert, update, delete or select); every call is recorded. */
function client(answers: Record<string, Answer>) {
  const log: { table: string; ops: Op[] }[] = [];
  const c = {
    from(table: string) {
      const ops: Op[] = [];
      const key = () => table + ':' + (ops.find((o) => ['insert', 'update', 'delete'].includes(o.name))?.name ?? 'select');
      const make = (): unknown =>
        new Proxy({}, {
          get(_t, prop: string) {
            if (prop === 'then') {
              log.push({ table, ops });
              return (resolve: (v: unknown) => void) => resolve({ data: null, error: null, ...answers[key()] });
            }
            return (...args: unknown[]) => {
              ops.push({ name: prop, args });
              if (prop === 'maybeSingle' || prop === 'single') {
                log.push({ table, ops });
                return Promise.resolve({ data: null, error: null, ...answers[key()] });
              }
              return make();
            };
          },
        });
      return make();
    },
  };
  return { supabase: c as unknown as SupabaseClient, log };
}

const find = (log: { table: string; ops: Op[] }[], table: string, name: string) => log.find((e) => e.table === table && e.ops.some((o) => o.name === name))?.ops.find((o) => o.name === name);

const base = { name: ' Groceries ', categoryId: CAT, rule: 'pct', pctBp: 1300, amount: null, cutoff: 'both', accountId: null, startsOn: null, endsOn: null, isDraft: false, countsToDaily: true, kind: 'normal' };

describe('saveLine', () => {
  it('inserts a new percent line with only the fields its rule uses', async () => {
    const { supabase, log } = client({ 'categories:select': { data: { id: CAT } }, 'budget_lines_v2:insert': { data: { id: LINE } } });
    expect(await saveLine(supabase, base)).toEqual({ ok: true });
    expect(find(log, 'budget_lines_v2', 'insert')?.args[0]).toEqual({
      category_id: CAT, name: 'Groceries', rule: 'pct', amount: null, amount_second: null, reimburse_amount: null, reimburse_cutoff: null, reimburse_day: null, pct_bp: 1300, cutoff: 'both', account_id: null,
      starts_on: null, ends_on: null, is_draft: false, counts_to_daily: true, kind: 'normal',
    });
  });

  it('updates an existing fixed line and turns months into the first day', async () => {
    const { supabase, log } = client({ 'categories:select': { data: { id: CAT } } });
    const r = await saveLine(supabase, { ...base, id: LINE, rule: 'fixed', amount: 150_000, pctBp: null, startsOn: '2027-03', endsOn: '2027-09' });
    expect(r).toEqual({ ok: true });
    expect(find(log, 'budget_lines_v2', 'update')?.args[0]).toMatchObject({ rule: 'fixed', amount: 150_000, pct_bp: null, starts_on: '2027-03-01', ends_on: '2027-09-01' });
  });

  it('rejects bad input before touching the database', async () => {
    const { supabase, log } = client({});
    expect(await saveLine(supabase, { ...base, name: '   ' })).toEqual({ error: 'Give the line a name of up to 60 characters.' });
    expect(await saveLine(supabase, { ...base, rule: 'fixed', amount: null })).toEqual({ error: 'Enter the amount per month, like 1,250.50.' });
    expect(log).toHaveLength(0);
  });

  it('refuses a category or account that is not there', async () => {
    expect(await saveLine(client({ 'categories:select': { data: null } }).supabase, base)).toEqual({ error: 'That category was not found.' });
    const { supabase } = client({ 'categories:select': { data: { id: CAT } }, 'accounts:select': { data: null } });
    expect(await saveLine(supabase, { ...base, accountId: ACC })).toEqual({ error: 'That account was not found.' });
  });

  it('moving the RTO contingency role frees it from the other line first, then creates its pool once', async () => {
    const { supabase, log } = client({ 'categories:select': { data: { id: CAT } }, 'budget_lines_v2:update': {}, 'pools:select': { data: null } });
    const r = await saveLine(supabase, { ...base, id: LINE, rule: 'fixed', amount: 100_000, pctBp: null, kind: 'rto_contingency' });
    expect(r).toEqual({ ok: true });
    const first = log.find((e) => e.table === 'budget_lines_v2')!;
    expect(first.ops.map((o) => o.name)).toEqual(['update', 'eq', 'neq']);
    expect(first.ops[0]!.args[0]).toEqual({ kind: 'normal' });
    expect(find(log, 'pools', 'insert')?.args[0]).toEqual({ name: 'RTO contingency', budget_line_id: LINE });
  });

  it('does not add a second pool when one exists', async () => {
    const { supabase, log } = client({ 'categories:select': { data: { id: CAT } }, 'pools:select': { data: { id: 'p1' } } });
    await saveLine(supabase, { ...base, id: LINE, rule: 'fixed', amount: 100_000, pctBp: null, kind: 'rto_contingency' });
    expect(find(log, 'pools', 'insert')).toBeUndefined();
  });

  it('reports a failed save without leaking the database message', async () => {
    const { supabase } = client({ 'categories:select': { data: { id: CAT } }, 'budget_lines_v2:insert': { error: { message: 'secret' } } });
    expect(await saveLine(supabase, base)).toEqual({ error: 'Could not save the line. Try again.' });
  });
});

describe('deleteLine', () => {
  it('deletes by id', async () => {
    const { supabase, log } = client({});
    expect(await deleteLine(supabase, LINE)).toEqual({ ok: true });
    expect(find(log, 'budget_lines_v2', 'delete')).toBeDefined();
  });
  it('rejects a bad id and reports a failure plainly', async () => {
    expect(await deleteLine(client({}).supabase, 'nope')).toEqual({ error: 'That line was not found.' });
    expect(await deleteLine(client({ 'budget_lines_v2:delete': { error: { message: 'x' } } }).supabase, LINE)).toEqual({ error: 'Could not delete that line. Try again.' });
  });
});
