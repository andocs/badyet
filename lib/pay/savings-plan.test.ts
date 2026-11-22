import { describe, expect, it } from 'vitest';
import { client, find } from '../../mobile/src/lib/fakeClient';
import { saveSavingsPlan, validateSavingsPlan } from './savings-plan';

const FUND = '33333333-3333-4333-8333-333333333333';
const err = (x: unknown) => {
  const r = validateSavingsPlan(x);
  return r.ok ? '' : r.error;
};

describe('validateSavingsPlan', () => {
  it('accepts off, a percent and an amount', () => {
    expect(validateSavingsPlan({ mode: 'off', percentBp: 600, amount: 5, fundId: FUND })).toEqual({ ok: true, value: { mode: 'off', percentBp: null, amount: null, fundId: null } });
    expect(validateSavingsPlan({ mode: 'percent', percentBp: 600, amount: null, fundId: FUND })).toMatchObject({ ok: true, value: { percentBp: 600, fundId: FUND } });
    expect(validateSavingsPlan({ mode: 'amount', percentBp: null, amount: 200_000, fundId: null })).toMatchObject({ ok: true, value: { amount: 200_000, fundId: null } });
  });
  it('says what is wrong', () => {
    expect(err({ mode: 'weekly' })).toMatch(/off, a percent/);
    expect(err({ mode: 'percent', percentBp: 0 })).toMatch(/more than 0/);
    expect(err({ mode: 'percent', percentBp: 10_001 })).toMatch(/up to 100/);
    expect(err({ mode: 'amount', amount: 0 })).toMatch(/each cutoff/);
    expect(err({ mode: 'amount', amount: 100, fundId: 'x' })).toMatch(/fund/);
  });
});

describe('saveSavingsPlan', () => {
  it('updates existing pay settings with the percent, clearing the amount', async () => {
    const { supabase, log } = client({ 'funds:select': { data: { id: FUND } }, 'pay_settings:select': { data: { user_id: 'u1' } } });
    expect(await saveSavingsPlan(supabase, { mode: 'percent', percentBp: 600, amount: null, fundId: FUND })).toEqual({ ok: true });
    expect(find(log, 'pay_settings', 'update')?.args[0]).toEqual({ savings_plan_bp: 600, savings_plan_amount: null, savings_plan_fund_id: FUND });
  });
  it('creates pay settings when there are none, with a fixed amount', async () => {
    const { supabase, log } = client({ 'pay_settings:select': { data: null } });
    expect(await saveSavingsPlan(supabase, { mode: 'amount', percentBp: null, amount: 200_000, fundId: null })).toEqual({ ok: true });
    expect(find(log, 'pay_settings', 'insert')?.args[0]).toEqual({ savings_plan_bp: 0, savings_plan_amount: 200_000, savings_plan_fund_id: null });
  });
  it('turns the plan off', async () => {
    const { supabase, log } = client({ 'pay_settings:select': { data: { user_id: 'u1' } } });
    await saveSavingsPlan(supabase, { mode: 'off' });
    expect(find(log, 'pay_settings', 'update')?.args[0]).toEqual({ savings_plan_bp: 0, savings_plan_amount: null, savings_plan_fund_id: null });
  });
  it('says to apply the update when the columns are missing, and refuses a missing fund', async () => {
    const missing = client({ 'pay_settings:select': { data: { user_id: 'u1' } }, 'pay_settings:update': { error: { code: '42703' } } });
    expect(await saveSavingsPlan(missing.supabase, { mode: 'amount', amount: 100 })).toMatchObject({ error: expect.stringMatching(/Apply the savings plan/) });
    const noFund = client({ 'funds:select': { data: null } });
    expect(await saveSavingsPlan(noFund.supabase, { mode: 'percent', percentBp: 100, fundId: FUND })).toMatchObject({ error: expect.stringMatching(/fund was not found/) });
  });
});
