import { describe, expect, it } from 'vitest';
import { client, find } from './fakeClient';
import { archiveFund, bulkOverride, reorderFunds, resetMonths, saveFund, saveOverride } from './fundsWrite';

const F1 = '11111111-1111-4111-8111-111111111111';
const F2 = '22222222-2222-4222-8222-222222222222';
const OV = '77777777-7777-4777-8777-777777777777';

describe('saveFund', () => {
  it('rejects a cap fund with no target', async () => {
    const { supabase, log } = client({});
    expect(await saveFund(supabase, { name: 'Trip', rule: 'cap' })).toHaveProperty('error');
    expect(log).toHaveLength(0);
  });
  it('a new fund goes last in priority', async () => {
    const { supabase, log } = client({ 'funds:select': { data: { priority: 3 } }, 'funds:insert': { data: { id: F1 } } });
    expect(await saveFund(supabase, { name: ' Trip ', rule: 'cap', target: 500_000, color: '#34d399' })).toEqual({ ok: true });
    expect(find(log, 'funds', 'insert')?.args[0]).toMatchObject({ name: 'Trip', rule: 'cap', target: 500_000, priority: 4 });
  });
  it('links the payroll savings plan to a new fund when asked, and moves it from another fund', async () => {
    const { supabase, log } = client({ 'funds:insert': { data: { id: F1 } }, 'pay_settings:select': { data: { user_id: 'u1', savings_plan_fund_id: 'other' } } });
    expect(await saveFund(supabase, { name: 'Savings', rule: 'cap', target: 500_000, color: '#34d399', linkPlan: true })).toEqual({ ok: true });
    expect(find(log, 'pay_settings', 'update')?.args[0]).toEqual({ savings_plan_fund_id: F1 });
  });
  it('turning the link off only clears it on the fund that has it', async () => {
    const has = client({ 'pay_settings:select': { data: { user_id: 'u1', savings_plan_fund_id: F1 } } });
    expect(await saveFund(has.supabase, { id: F1, name: 'Trip', rule: 'cap', target: 500_000, linkPlan: false })).toEqual({ ok: true });
    expect(find(has.log, 'pay_settings', 'update')?.args[0]).toEqual({ savings_plan_fund_id: null });
    const other = client({ 'pay_settings:select': { data: { user_id: 'u1', savings_plan_fund_id: 'someone-else' } } });
    expect(await saveFund(other.supabase, { id: F1, name: 'Trip', rule: 'cap', target: 500_000, linkPlan: false })).toEqual({ ok: true });
    expect(find(other.log, 'pay_settings', 'update')).toBeUndefined();
  });
  it('updates an existing fund without touching priority', async () => {
    const { supabase, log } = client({});
    expect(await saveFund(supabase, { id: F1, name: 'Trip', rule: 'fixed', fixedAmount: 100_000 })).toEqual({ ok: true });
    const u = find(log, 'funds', 'update')?.args[0] as Record<string, unknown>;
    expect(u).toMatchObject({ rule: 'fixed', fixed_amount: 100_000 });
    expect(u).not.toHaveProperty('priority');
  });
});

describe('archive and reorder', () => {
  it('archives by id and refuses junk', async () => {
    const { supabase, log } = client({});
    expect(await archiveFund(supabase, 'x')).toHaveProperty('error');
    expect(await archiveFund(supabase, F1)).toEqual({ ok: true });
    expect((find(log, 'funds', 'update')?.args[0] as { archived_at: string }).archived_at).toBeTruthy();
  });
  it('writes priority as position', async () => {
    const { supabase, log } = client({});
    expect(await reorderFunds(supabase, [F2, F1])).toEqual({ ok: true });
    const updates = log.filter((e) => e.table === 'funds').map((e) => e.ops.find((o) => o.name === 'update')!.args[0]);
    expect(updates).toEqual([{ priority: 1 }, { priority: 2 }]);
  });
});

describe('overrides', () => {
  it('an empty override deletes the month', async () => {
    const { supabase, log } = client({ 'month_overrides:select': { data: { id: OV } } });
    expect(await saveOverride(supabase, { months: ['2026-12'], order: null, pins: {}, skips: [], note: null })).toEqual({ ok: true });
    expect(find(log, 'month_overrides', 'delete')).toBeDefined();
  });
  it('a pin and a skip are written to month_fund_overrides', async () => {
    const { supabase, log } = client({ 'funds:select': { data: [{ id: F1 }, { id: F2 }] }, 'month_overrides:insert': { data: { id: OV } } });
    expect(await saveOverride(supabase, { months: ['2026-12'], order: [F2, F1], pins: { [F1]: 500_000 }, skips: [F2], note: 'bonus month' })).toEqual({ ok: true });
    expect(find(log, 'month_overrides', 'insert')?.args[0]).toEqual({ month: '2026-12-01', fund_order: [F2, F1], note: 'bonus month' });
    expect(find(log, 'month_fund_overrides', 'insert')?.args[0]).toEqual([
      { override_id: OV, fund_id: F1, pin_amount: 500_000, skip: false },
      { override_id: OV, fund_id: F2, pin_amount: null, skip: true },
    ]);
  });
  it('refuses a fund that is both pinned and skipped, and unknown funds', async () => {
    const { supabase } = client({});
    expect(await saveOverride(supabase, { months: ['2026-12'], order: null, pins: { [F1]: 1 }, skips: [F1] })).toHaveProperty('error');
    expect(await saveOverride(supabase, { months: ['2026-12'], order: null, pins: { [F1]: 1 }, skips: [] })).toEqual({ error: 'One of those funds was not found.' });
  });
  it('resetMonths needs valid months', async () => {
    const { supabase, log } = client({});
    expect(await resetMonths(supabase, [])).toEqual({ error: 'Pick the months.' });
    expect(await resetMonths(supabase, ['2026-12'])).toEqual({ ok: true });
    expect(find(log, 'month_overrides', 'delete')).toBeDefined();
  });
  it('bulk first puts the fund at the front of the default order', async () => {
    const { supabase, log } = client({ 'funds:select': { data: [{ id: F1 }, { id: F2 }] }, 'month_overrides:insert': { data: { id: OV } } });
    expect(await bulkOverride(supabase, { months: ['2026-12'], op: 'first', fundId: F2 })).toEqual({ ok: true });
    expect(find(log, 'month_overrides', 'insert')?.args[0]).toMatchObject({ fund_order: [F2, F1] });
  });
  it('bulk pin needs an amount', async () => {
    const { supabase } = client({ 'funds:select': { data: [{ id: F1 }] } });
    expect(await bulkOverride(supabase, { months: ['2026-12'], op: 'pin', fundId: F1 })).toEqual({ error: 'Enter the amount to pin.' });
  });
});
