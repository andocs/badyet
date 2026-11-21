import { describe, expect, it } from 'vitest';
import { archiveRule, saveRule } from './bonusRules';
import { client, find } from './fakeClient';

const R = '88888888-8888-4888-8888-888888888888';
const base = { name: ' 13th month ', recurrence: 'yearly', kind: 'thirteenth', payMonth: 12, onceOn: null, cutoff: 'second', formula: 'base_multiple', baseMultipleBp: 10_000, eligibleAmount: null, componentNum: null, fixedAmount: null, deMinimis: 0 };

describe('saveRule', () => {
  it('rejects a nameless rule', async () => {
    const { supabase, log } = client({});
    expect(await saveRule(supabase, { ...base, name: ' ' })).toHaveProperty('error');
    expect(log).toHaveLength(0);
  });
  it('inserts only the columns its formula uses', async () => {
    const { supabase, log } = client({});
    expect(await saveRule(supabase, base)).toEqual({ ok: true });
    expect(find(log, 'bonus_rules', 'insert')?.args[0]).toMatchObject({ name: '13th month', formula: 'base_multiple', base_multiple_bp: 10_000, fixed_amount: null, eligible_amount: null, once_on: null });
  });
  it('updates by id', async () => {
    const { supabase, log } = client({});
    await saveRule(supabase, { ...base, id: R });
    expect(find(log, 'bonus_rules', 'update')).toBeDefined();
  });
});

describe('archiveRule', () => {
  it('archives instead of deleting', async () => {
    const { supabase, log } = client({});
    expect(await archiveRule(supabase, 'x')).toHaveProperty('error');
    expect(await archiveRule(supabase, R)).toEqual({ ok: true });
    expect(find(log, 'bonus_rules', 'delete')).toBeUndefined();
    expect((find(log, 'bonus_rules', 'update')?.args[0] as { archived_at: string }).archived_at).toBeTruthy();
  });
});
