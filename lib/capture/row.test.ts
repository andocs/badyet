import { describe, expect, it } from 'vitest';
import type { Decision } from './decide';
import type { Parsed } from './parsers';
import { accountWords, buildRow, dedupeKey, resolveAccount, type AccountLite } from './row';
import { defaultConfig } from './sources';

const parsed = (over: Partial<Parsed> = {}): Parsed => ({
  source: 'gcash', direction: 'out', amount: 11_500, counterparty: 'NEW POWER', counterpartyLast4: null, accountHint: null, ref: null, accountName: null, ...over,
});
const T = Date.parse('2026-11-21T01:30:20Z');

describe('dedupeKey', () => {
  it('uses the reference number when there is one, so a repeat at another time is still a repeat', () => {
    expect(dedupeKey(parsed({ ref: '111913449' }), T)).toBe('gcash|ref|111913449');
    expect(dedupeKey(parsed({ ref: '111913449' }), T + 3_600_000)).toBe('gcash|ref|111913449');
  });
  it('without one, the same event in the same minute matches, a different minute or amount does not', () => {
    expect(dedupeKey(parsed(), T)).toBe(dedupeKey(parsed({ counterparty: 'new power' }), T + 20_000));
    expect(dedupeKey(parsed(), T)).not.toBe(dedupeKey(parsed(), T + 60_000));
    expect(dedupeKey(parsed(), T)).not.toBe(dedupeKey(parsed({ amount: 11_501 }), T));
  });
});

describe('resolveAccount', () => {
  const accounts: AccountLite[] = [
    { id: 'a-gcash', name: 'GCash', institution: null, last4: null },
    { id: 'a-bpi', name: 'BPI Payroll', institution: 'BPI', last4: '8167' },
    { id: 'a-maya', name: 'Maya Savings', institution: 'Maya', last4: null },
  ];
  it('uses the account you chose for the source', () => {
    expect(resolveAccount({ ...defaultConfig('maya'), accountId: 'a-bpi' }, parsed({ source: 'maya' }), accounts)).toBe('a-bpi');
  });
  it('ignores a chosen account that no longer exists', () => {
    expect(resolveAccount({ ...defaultConfig('gcash'), accountId: 'gone' }, parsed(), accounts)).toBe('a-gcash');
  });
  it('matches the last digits of your account', () => {
    expect(resolveAccount(defaultConfig('bpi'), parsed({ source: 'bpi', accountHint: '167' }), accounts)).toBe('a-bpi');
  });
  it('matches the only account named like the source', () => {
    expect(resolveAccount(defaultConfig('gcash'), parsed(), accounts)).toBe('a-gcash');
    expect(resolveAccount(defaultConfig('maya'), parsed({ source: 'maya' }), accounts)).toBe('a-maya');
  });
  it('returns null rather than guess when none or several match', () => {
    expect(resolveAccount(defaultConfig('grab'), parsed({ source: 'grab' }), accounts)).toBeNull();
    const two: AccountLite[] = [
      { id: 'a-g1', name: 'GCash Savings', institution: null, last4: null },
      { id: 'a-g2', name: 'GCash Wallet', institution: null, last4: null },
    ];
    expect(resolveAccount(defaultConfig('gcash'), parsed(), two)).toBeNull();
  });
  describe('several accounts share the source name', () => {
    const mayas: AccountLite[] = [
      { id: 'm-wallet', name: 'Maya', institution: null, last4: '0325' },
      { id: 'm-black', name: 'Maya Black', institution: 'Maya', last4: null },
      { id: 'm-save', name: 'Maya Savings', institution: 'Maya', last4: null },
      { id: 'g-cash', name: 'GCash', institution: null, last4: '0325' },
    ];
    it('picks the account named exactly like the source', () => {
      expect(resolveAccount(defaultConfig('maya'), parsed({ source: 'maya' }), mayas)).toBe('m-wallet');
    });
    it('is case and space blind', () => {
      const odd = mayas.map((a) => (a.id === 'm-wallet' ? { ...a, name: ' maya ' } : a));
      expect(resolveAccount(defaultConfig('maya'), parsed({ source: 'maya' }), odd)).toBe('m-wallet');
    });
    it('still asks when no account is named exactly like it', () => {
      const renamed = mayas.map((a) => (a.id === 'm-wallet' ? { ...a, name: 'Maya Wallet' } : a));
      expect(resolveAccount(defaultConfig('maya'), parsed({ source: 'maya' }), renamed)).toBeNull();
    });
    it('a message naming Maya Black lands on Maya Black', () => {
      expect(resolveAccount(defaultConfig('maya'), parsed({ source: 'maya', accountName: 'Maya Black' }), mayas)).toBe('m-black');
    });
    it('a shared last4 is not used to pick one of them', () => {
      expect(resolveAccount(defaultConfig('maya'), parsed({ source: 'maya', accountHint: '0325' }), mayas)).toBe('m-wallet');
    });
  });
});

describe('accountWords', () => {
  it('keeps what identifies an account and drops filler', () => {
    expect(accountWords({ name: 'BPI Payroll Savings', institution: 'BPI' })).toEqual(['bpi', 'payroll', 'bpi']);
  });
});

describe('buildRow', () => {
  const keep = (over: Partial<Extract<Decision, { keep: true }>> = {}): Extract<Decision, { keep: true }> => ({ keep: true, status: 'pending', accountId: 'a', categoryId: null, ruleId: null, ...over });
  it('spending is negative, pending, and from a notification', () => {
    expect(buildRow({ id: 'id1', parsed: parsed(), decision: keep(), accountId: 'a', postTime: T, hash: 'h' })).toEqual({
      id: 'id1', account_id: 'a', occurred_at: new Date(T).toISOString(), amount: -11_500, merchant: 'NEW POWER', kind: 'expense',
      category_id: null, source: 'notification', status: 'pending', confirmed_at: null, dedupe_hash: 'h',
    });
  });
  it('income is positive, and a confirmed row carries its confirmation time and category', () => {
    const r = buildRow({ id: 'id2', parsed: parsed({ direction: 'in', amount: 90_000 }), decision: keep({ status: 'confirmed', categoryId: 'c' }), accountId: 'a', postTime: T, hash: 'h' });
    expect(r).toMatchObject({ amount: 90_000, kind: 'income', status: 'confirmed', category_id: 'c', confirmed_at: new Date(T).toISOString() });
  });
});
