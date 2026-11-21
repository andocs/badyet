import { describe, expect, it } from 'vitest';
import { buildAccounts } from './accounts';

const acct = (id: string, kind = 'ewallet') => ({ id, name: id, kind, institution: null, last4: null, color: null });

describe('buildAccounts', () => {
  it('balance is the latest anchor plus confirmed transactions after it', () => {
    const r = buildAccounts(
      [acct('gcash')],
      [
        { account_id: 'gcash', as_of: '2026-11-01T00:00:00Z', amount: 100_000 },
        { account_id: 'gcash', as_of: '2026-11-10T00:00:00Z', amount: 200_000 },
      ],
      [
        { account_id: 'gcash', occurred_at: '2026-11-05T00:00:00Z', amount: -5_000, status: 'confirmed' }, // before the latest anchor
        { account_id: 'gcash', occurred_at: '2026-11-12T00:00:00Z', amount: -30_000, status: 'confirmed' },
        { account_id: 'gcash', occurred_at: '2026-11-13T00:00:00Z', amount: -9_900, status: 'pending' }, // never counts
      ],
      [],
    );
    expect(r.spending[0]!.balance).toBe(170_000);
    expect(r.pending).toBe(1);
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
    expect(r.spending[0]!.confirmedOn).toBeNull();
  });
});
