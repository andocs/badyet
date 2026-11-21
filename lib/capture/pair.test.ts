import { describe, expect, it } from 'vitest';
import { findTransferPairs, type PairCandidate } from './pair';
import type { AccountLite } from './row';

const accounts: AccountLite[] = [
  { id: 'maya', name: 'Maya', institution: null, last4: null },
  { id: 'bpi', name: 'BPI Payroll', institution: 'BPI', last4: '8167' },
  { id: 'gcash', name: 'GCash', institution: null, last4: null },
  { id: 'gotyme', name: 'GoTyme', institution: null, last4: null },
];
const T = Date.parse('2026-11-21T03:55:00Z');
const row = (id: string, accountId: string, amount: number, secs: number, counterparty: string | null, last4?: string): PairCandidate => ({
  id, accountId, amount, at: T + secs * 1000, counterparty, counterpartyLast4: last4,
});

describe('findTransferPairs', () => {
  it('pairs Maya out with the matching BPI in, as in the real test transfer', () => {
    const pairs = findTransferPairs([row('o', 'maya', -5_000, 0, 'BPI / VYBE by BPI'), row('i', 'bpi', 5_000, 16, 'Maya Philippines, Inc.')], accounts);
    expect(pairs).toEqual([{ outId: 'o', inId: 'i' }]);
  });

  it('pairs when only one side names the other account', () => {
    expect(findTransferPairs([row('o', 'gotyme', -100, 0, 'Kenneth Docot Bank Of The Philippine Islands (BPI)'), row('i', 'bpi', 100, 30, null)], accounts)).toEqual([{ outId: 'o', inId: 'i' }]);
  });

  it('pairs by the other account digits when no name matches', () => {
    expect(findTransferPairs([row('o', 'gotyme', -100, 0, 'Kenneth', '8167'), row('i', 'bpi', 100, 30, null)], accounts)).toEqual([{ outId: 'o', inId: 'i' }]);
  });

  it('does not pair equal amounts that have nothing to do with each other', () => {
    expect(findTransferPairs([row('o', 'gcash', -5_000, 0, 'Jollibee'), row('i', 'bpi', 5_000, 20, 'Salary advance')], accounts)).toEqual([]);
  });

  it('needs different accounts, opposite directions, equal amounts and a short gap', () => {
    const base = [row('o', 'maya', -5_000, 0, 'BPI')];
    expect(findTransferPairs([...base, row('i', 'maya', 5_000, 5, 'BPI')], accounts)).toEqual([]); // same account
    expect(findTransferPairs([...base, row('i', 'bpi', 5_001, 5, 'Maya')], accounts)).toEqual([]); // amount differs
    expect(findTransferPairs([...base, row('i', 'bpi', 5_000, 11 * 60, 'Maya')], accounts)).toEqual([]); // 11 minutes
    expect(findTransferPairs([...base, row('i', 'bpi', -5_000, 5, 'Maya')], accounts)).toEqual([]); // both out
  });

  it('pairs each row once, closest in time first', () => {
    const rows = [
      row('o1', 'maya', -5_000, 0, 'BPI'),
      row('o2', 'maya', -5_000, 100, 'BPI'),
      row('i1', 'bpi', 5_000, 110, 'Maya'),
    ];
    expect(findTransferPairs(rows, accounts)).toEqual([{ outId: 'o2', inId: 'i1' }]);
  });

  it('ignores rows for accounts it does not know', () => {
    expect(findTransferPairs([row('o', 'ghost', -100, 0, 'BPI'), row('i', 'bpi', 100, 1, 'x')], accounts)).toEqual([]);
  });
});
