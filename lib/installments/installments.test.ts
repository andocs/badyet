import { describe, expect, it } from 'vitest';
import type { IsoDate } from '@/lib/domain/dates';
import { client, find } from '../../mobile/src/lib/fakeClient';
import { validateInstallment } from './input';
import { deleteInstallment, saveInstallment } from './save';
import { summarizePlan } from './summary';

const ACC = '22222222-2222-4222-8222-222222222222';
const PLAN = '33333333-3333-4333-8333-333333333333';
const base = { name: ' Phone ', kind: 'card', price: 3_600_000, downPayment: 0, termCount: 12, rateBp: 0, firstDueOn: '2026-12-15', cutoff: 'second', accountId: null };
const err = (x: unknown) => {
  const r = validateInstallment(x);
  return r.ok ? '' : r.error;
};

describe('validateInstallment', () => {
  it('accepts a card plan and a loan', () => {
    expect(validateInstallment(base)).toMatchObject({ ok: true, value: { name: 'Phone', termCount: 12, downPayment: 0, rateBp: 0 } });
    expect(validateInstallment({ ...base, kind: 'loan', rateBp: 1500, accountId: ACC })).toMatchObject({ ok: true, value: { kind: 'loan', rateBp: 1500, accountId: ACC } });
  });
  it('says what is wrong in plain words', () => {
    expect(err({ ...base, name: ' ' })).toMatch(/name/);
    expect(err({ ...base, kind: 'gift' })).toMatch(/card plan or loan/);
    expect(err({ ...base, price: 0 })).toMatch(/price/);
    expect(err({ ...base, downPayment: 3_600_000 })).toMatch(/less than the price/);
    expect(err({ ...base, termCount: 0 })).toMatch(/monthly payments/);
    expect(err({ ...base, rateBp: 20_000 })).toMatch(/0 to 100%/);
    expect(err({ ...base, firstDueOn: '2026-02-30' })).toMatch(/first payment/);
    expect(err({ ...base, cutoff: 'both' })).toMatch(/cutoff/);
    expect(err({ ...base, accountId: 'x' })).toMatch(/account/);
  });
});

describe('summarizePlan', () => {
  it('works out a no-interest plan', () => {
    const s = summarizePlan({ price: 3_600_000, downPayment: 0, termCount: 12, rateBp: 0, firstDueOn: '2026-12-15' }, '2027-02-20' as IsoDate);
    expect(s).toMatchObject({ payment: 300_000, financed: 3_600_000, total: 3_600_000, interest: 0, endsOn: '2027-11', paid: 3, remaining: 9, remainingAmount: 2_700_000, nextDue: '2027-03-15', done: false });
  });
  it('shows what interest adds, and a finished plan', () => {
    const s = summarizePlan({ price: 2_000_000, downPayment: 0, termCount: 60, rateBp: 600, firstDueOn: '2026-01-01' }, '2026-01-01' as IsoDate);
    expect(s.interest).toBeGreaterThan(0);
    expect(summarizePlan({ price: 100_000, downPayment: 0, termCount: 2, rateBp: 0, firstDueOn: '2026-01-01' }, '2030-01-01' as IsoDate)).toMatchObject({ done: true, remaining: 0, nextDue: null });
  });
  it('takes the down payment off what is financed', () => {
    expect(summarizePlan({ price: 1_000_000, downPayment: 400_000, termCount: 6, rateBp: 0, firstDueOn: '2026-12-01' }, '2026-01-01' as IsoDate)).toMatchObject({ financed: 600_000, payment: 100_000 });
  });
});

describe('saveInstallment', () => {
  it('saves the plan and a budget line for the monthly payment, from the first month to the last', async () => {
    const { supabase, log } = client({ 'installment_plans:insert': { data: { id: PLAN } }, 'categories:select': { data: { id: 'cat1' } } });
    expect(await saveInstallment(supabase, base)).toEqual({ ok: true });
    expect(find(log, 'installment_plans', 'insert')?.args[0]).toMatchObject({ name: 'Phone', term_count: 12, first_due_on: '2026-12-15', cutoff: 'second' });
    expect(find(log, 'budget_lines_v2', 'insert')?.args[0]).toMatchObject({
      name: 'Phone', rule: 'fixed', amount: 300_000, cutoff: 'second', starts_on: '2026-12-01', ends_on: '2027-11-01', source: 'installment', source_id: PLAN, category_id: 'cat1',
    });
  });
  it('updates the existing line when the plan is edited', async () => {
    const { supabase, log } = client({ 'installment_plans:update': { data: [{ id: PLAN }] }, 'budget_lines_v2:select': { data: { id: 'line1' } } });
    expect(await saveInstallment(supabase, { ...base, id: PLAN, termCount: 6 })).toEqual({ ok: true });
    expect(find(log, 'budget_lines_v2', 'update')?.args[0]).toMatchObject({ amount: 600_000, ends_on: '2027-05-01' });
    expect(find(log, 'budget_lines_v2', 'insert')).toBeUndefined();
  });
  it('refuses a bad plan without touching the database', async () => {
    const { supabase, log } = client({});
    expect(await saveInstallment(supabase, { ...base, price: 0 })).toMatchObject({ error: expect.stringMatching(/price/) });
    expect(log).toHaveLength(0);
  });
  it('deletes the line and the plan', async () => {
    const { supabase, log } = client({});
    expect(await deleteInstallment(supabase, PLAN)).toEqual({ ok: true });
    expect(find(log, 'budget_lines_v2', 'delete')).toBeDefined();
    expect(find(log, 'installment_plans', 'delete')).toBeDefined();
    expect(await deleteInstallment(supabase, 'nope')).toMatchObject({ error: expect.any(String) });
  });
});
