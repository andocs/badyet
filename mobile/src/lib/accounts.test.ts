import { describe, expect, it } from 'vitest';
import { buildAccounts, type TxnRow } from './accounts';

const acct = (id: string, kind = 'ewallet') => ({ id, name: id, kind, institution: null, last4: null, color: null, credit_limit: null });
const tx = (id: string, account_id: string, occurred_at: string, amount: number, status: TxnRow['status']): TxnRow => ({
  id, account_id, occurred_at, amount, merchant: null, kind: 'expense', status,
});

describe('buildAccounts', () => {
  it('balance is the latest anchor plus confirmed transactions after it', () => {
    const r = buildAccounts(
      [acct('gcash')],
      [
        { account_id: 'gcash', as_of: '2026-11-01T00:00:00Z', amount: 100_000 },
        { account_id: 'gcash', as_of: '2026-11-10T00:00:00Z', amount: 200_000 },
      ],
      [
        tx('a', 'gcash', '2026-11-05T00:00:00Z', -5_000, 'confirmed'), // before the latest anchor
        tx('b', 'gcash', '2026-11-12T00:00:00Z', -30_000, 'confirmed'),
        tx('c', 'gcash', '2026-11-13T00:00:00Z', -9_900, 'pending'), // never counts
      ],
      [],
    );
    const g = r.spending[0]!;
    expect(g.balance).toBe(170_000);
    expect(r.pendingCount).toBe(1);
    // The detail math lists only what the balance used, and shows pending separately.
    expect(g.after.map((t) => t.id)).toEqual(['b']);
    expect(g.pending.map((t) => t.id)).toEqual(['c']);
    expect(g.pendingTotal).toBe(-9_900);
    expect(g.latest?.amount).toBe(200_000);
  });

  it('leaves credit cards out of the total and splits fund accounts', () => {
    const r = buildAccounts(
      [acct('bpi', 'debit'), acct('card', 'credit'), acct('save', 'savings')],
      [
        { account_id: 'bpi', as_of: '2026-11-01T00:00:00Z', amount: 50_000 },
        { account_id: 'card', as_of: '2026-11-01T00:00:00Z', amount: -20_000 },
        { account_id: 'save', as_of: '2026-11-01T00:00:00Z', amount: 10_000 },
      ],
      [],
      [{ name: 'Emergency', linked_account_id: 'save' }],
    );
    expect(r.total).toBe(60_000);
    expect(r.funds.map((f) => f.id)).toEqual(['save']);
    expect(r.spending.map((f) => f.id)).toEqual(['bpi', 'card']);
    expect(r.funds[0]!.fund).toBe('Emergency');
  });

  it('an account with no anchor starts at zero and says so', () => {
    const r = buildAccounts([acct('maya')], [], [], []);
    expect(r.spending[0]!.balance).toBe(0);
    expect(r.spending[0]!.latest).toBeNull();
  });

  it('picks a colour from the account itself when it has none, so reordering never changes it, and keeps its own otherwise', () => {
    const r = buildAccounts([acct('a'), { ...acct('b'), color: '#123456' }], [], [], []);
    expect(r.spending[1]!.color).toBe('#123456');
    const first = r.spending[0]!.color;
    const swapped = buildAccounts([{ ...acct('b'), color: '#123456' }, acct('a')], [], [], []);
    expect(swapped.spending[1]!.color).toBe(first);
  });
});
