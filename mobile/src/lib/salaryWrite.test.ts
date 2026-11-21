import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { confirmEvent, deleteAllowance, deleteEvent, saveAssumptions, setAllowance } from './salaryWrite';

const ID = '44444444-4444-4444-8444-444444444444';
const USER = '99999999-9999-4999-8999-999999999999';

type Answer = { data?: unknown; error?: unknown };
type Op = { name: string; args: unknown[] };

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
              if (prop === 'maybeSingle') {
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
const op = (log: { table: string; ops: Op[] }[], table: string, name: string) => log.find((e) => e.table === table && e.ops.some((o) => o.name === name))?.ops.find((o) => o.name === name);

describe('events', () => {
  it('confirms an expected event', async () => {
    const { supabase, log } = client({});
    expect(await confirmEvent(supabase, ID)).toEqual({ ok: true });
    expect(op(log, 'salary_events', 'update')?.args[0]).toEqual({ status: 'confirmed' });
    expect(await confirmEvent(supabase, 'x')).toEqual({ error: 'That event was not found.' });
  });

  it('removes a raise but never the start event', async () => {
    const raise = client({ 'salary_events:select': { data: { kind: 'merit' } } });
    expect(await deleteEvent(raise.supabase, ID)).toEqual({ ok: true });
    expect(op(raise.log, 'salary_events', 'delete')).toBeDefined();

    const start = client({ 'salary_events:select': { data: { kind: 'start' } } });
    expect(await deleteEvent(start.supabase, ID)).toEqual({ error: 'The start event is your base pay. Add a raise instead of removing it.' });
    expect(op(start.log, 'salary_events', 'delete')).toBeUndefined();

    expect(await deleteEvent(client({}).supabase, ID)).toEqual({ error: 'That event was not found.' });
  });
});

describe('saveAssumptions', () => {
  it('checks the percent and month before saving', async () => {
    const { supabase, log } = client({});
    expect(await saveAssumptions(supabase, { on: true, pctBp: -1, month: 3 })).toEqual({ error: 'Enter a raise between 0% and 1,000%.' });
    expect(await saveAssumptions(supabase, { on: true, pctBp: 500, month: 13 })).toEqual({ error: 'Pick a month.' });
    expect(await saveAssumptions(supabase, { on: true, pctBp: 1.5, month: 3 })).toEqual({ error: 'Enter a raise between 0% and 1,000%.' });
    expect(log).toHaveLength(0);
  });
  it('inserts the first time and updates after', async () => {
    const first = client({ 'plan_assumptions:select': { data: null } });
    expect(await saveAssumptions(first.supabase, { on: true, pctBp: 500, month: 3 })).toEqual({ ok: true });
    expect(op(first.log, 'plan_assumptions', 'insert')?.args[0]).toEqual({ assumed_raise_on: true, assumed_raise_bp: 500, assumed_raise_month: 3 });

    const again = client({ 'plan_assumptions:select': { data: { user_id: USER } } });
    await saveAssumptions(again.supabase, { on: false, pctBp: 0, month: 1 });
    expect(op(again.log, 'plan_assumptions', 'update')?.args[0]).toEqual({ assumed_raise_on: false, assumed_raise_bp: 0, assumed_raise_month: 1 });
  });
});

describe('allowances', () => {
  it('changes the payslip cutoff or taxable flag, and nothing else', async () => {
    const { supabase, log } = client({});
    expect(await setAllowance(supabase, ID, { cutoff: 'first', taxable: true })).toEqual({ ok: true });
    expect(op(log, 'allowances', 'update')?.args[0]).toEqual({ payslip_cutoff: 'first', taxable: true });
    expect(await setAllowance(supabase, ID, {})).toEqual({ error: 'Nothing to change.' });
    expect(await setAllowance(supabase, 'x', { cutoff: 'first' })).toEqual({ error: 'That allowance was not found.' });
  });
  it('removes one, reporting a failure plainly', async () => {
    expect(await deleteAllowance(client({}).supabase, ID)).toEqual({ ok: true });
    expect(await deleteAllowance(client({ 'allowances:delete': { error: { message: 'x' } } }).supabase, ID)).toEqual({ error: 'Could not remove that. Try again.' });
    expect(await deleteAllowance(client({}).supabase, 'nope')).toEqual({ error: 'That allowance was not found.' });
  });
});
