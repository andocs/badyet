import { describe, expect, it } from 'vitest';
import { decide, type Captured } from './decide';
import { defaultConfig, type CaptureRule, type SourceConfig } from './sources';

const ACC = '22222222-2222-4222-8222-222222222222';
const CAT = '33333333-3333-4333-8333-333333333333';
const CAT2 = '44444444-4444-4444-8444-444444444444';

const cap = (over: Partial<Captured> = {}): Captured => ({ source: 'gcash', amount: 15_000, direction: 'out', text: 'You have paid P150.00 of GCash to Jollibee', ...over });
const cfg = (over: Partial<SourceConfig> = {}): SourceConfig => ({ ...defaultConfig('gcash'), ...over });
const rule = (over: Partial<CaptureRule>): CaptureRule => ({ id: 'r1', source: null, matchText: 'x', action: 'ignore', categoryId: null, ...over });

describe('decide', () => {
  it('keeps a capture as pending by default', () => {
    expect(decide(cap(), cfg(), [])).toEqual({ keep: true, status: 'pending', accountId: null, categoryId: null, ruleId: null });
  });

  it('skips a source that is switched off', () => {
    expect(decide(cap(), cfg({ enabled: false }), [])).toEqual({ keep: false, reason: 'source-off' });
  });

  it('skips amounts below the minimum but keeps the minimum itself', () => {
    expect(decide(cap({ amount: 4_999 }), cfg({ minAmount: 5_000 }), [])).toEqual({ keep: false, reason: 'under-minimum' });
    expect(decide(cap({ amount: 5_000 }), cfg({ minAmount: 5_000 }), [])).toMatchObject({ keep: true });
  });

  it('an ignore rule skips it, matching case-insensitively', () => {
    const r = rule({ matchText: 'CASHBACK', action: 'ignore' });
    expect(decide(cap({ text: 'You got cashback of P1' }), cfg(), [r])).toEqual({ keep: false, reason: 'ignore-rule' });
    expect(decide(cap({ text: 'You paid Jollibee' }), cfg(), [r])).toMatchObject({ keep: true });
  });

  it('a rule for another source does not apply', () => {
    const r = rule({ source: 'maya', matchText: 'jollibee', action: 'ignore' });
    expect(decide(cap(), cfg(), [r])).toMatchObject({ keep: true });
  });

  it('a set-category rule beats the source default, and a source-specific rule beats an all-sources rule', () => {
    const rules = [
      rule({ id: 'a', source: null, matchText: 'jollibee', action: 'set_category', categoryId: CAT2 }),
      rule({ id: 'b', source: 'gcash', matchText: 'jollibee', action: 'set_category', categoryId: CAT }),
    ];
    expect(decide(cap(), cfg({ categoryId: CAT2 }), rules)).toMatchObject({ categoryId: CAT, ruleId: 'b' });
    expect(decide(cap(), cfg({ categoryId: CAT2 }), [])).toMatchObject({ categoryId: CAT2, ruleId: null });
  });

  it('a longer keyword wins over a shorter one for the same source', () => {
    const rules = [
      rule({ id: 'a', source: 'gcash', matchText: 'paid', action: 'set_category', categoryId: CAT2 }),
      rule({ id: 'b', source: 'gcash', matchText: 'paid p150.00', action: 'set_category', categoryId: CAT }),
    ];
    expect(decide(cap(), cfg(), rules)).toMatchObject({ categoryId: CAT });
  });

  it('income never gets a category', () => {
    const rules = [rule({ matchText: 'received', action: 'set_category', categoryId: CAT })];
    expect(decide(cap({ direction: 'in', text: 'You have received 900.00' }), cfg({ categoryId: CAT }), rules)).toMatchObject({ categoryId: null });
  });

  it('auto-confirm needs an account, and a category for spending; otherwise it stays pending', () => {
    expect(decide(cap(), cfg({ autoConfirm: true }), [])).toMatchObject({ status: 'pending' });
    expect(decide(cap(), cfg({ autoConfirm: true, accountId: ACC }), [])).toMatchObject({ status: 'pending' });
    expect(decide(cap(), cfg({ autoConfirm: true, accountId: ACC, categoryId: CAT }), [])).toMatchObject({ status: 'confirmed', accountId: ACC, categoryId: CAT });
  });

  it('auto-confirmed income needs only an account', () => {
    expect(decide(cap({ direction: 'in' }), cfg({ autoConfirm: true, accountId: ACC }), [])).toMatchObject({ status: 'confirmed', categoryId: null });
  });

  it('an auto-confirm rule confirms even when the source is not set to', () => {
    const r = rule({ id: 'c', matchText: 'jollibee', action: 'auto_confirm' });
    expect(decide(cap(), cfg({ accountId: ACC, categoryId: CAT }), [r])).toMatchObject({ status: 'confirmed', ruleId: 'c' });
  });

  it('ignore wins over auto-confirm', () => {
    const rules = [rule({ id: 'i', matchText: 'jollibee', action: 'ignore' }), rule({ id: 'c', matchText: 'jollibee', action: 'auto_confirm' })];
    expect(decide(cap(), cfg({ accountId: ACC, categoryId: CAT }), rules)).toEqual({ keep: false, reason: 'ignore-rule' });
  });
});
