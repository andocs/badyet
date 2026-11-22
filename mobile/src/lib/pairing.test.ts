import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { pairRecent } from './pairing';

const NOW = Date.parse('2026-11-21T04:00:00Z');
const accounts = [
  { id: 'maya', name: 'Maya', institution: null, last4: null },
  { id: 'bpi', name: 'BPI Payroll', institution: 'BPI', last4: '8167' },
];

type Answer = { data?: unknown; error?: unknown };
function client(answers: { accounts: Answer; transactions: Answer; categories?: Answer }) {
  const updates: { payload: unknown; id: unknown }[] = [];
  const c = {
    from(table: string) {
      const state: { update?: unknown; id?: unknown } = {};
      const chain: unknown = new Proxy({}, {
        get(_t, prop: string) {
          if (prop === 'then') {
            return (resolve: (v: unknown) => void) => {
              if (state.update !== undefined) updates.push({ payload: state.update, id: state.id });
              resolve({ data: null, error: null, ...(state.update !== undefined ? {} : answers[table as 'accounts' | 'transactions' | 'categories']) });
            };
          }
          return (...args: unknown[]) => {
            if (prop === 'update') state.update = args[0];
            if (prop === 'eq' && args[0] === 'id') state.id = args[1];
            return chain;
          };
        },
      });
      return chain;
    },
  };
  return { supabase: c as unknown as SupabaseClient, updates };
}

const tx = (id: string, account_id: string, amount: number, secs: number, merchant: string | null) => ({ id, account_id, amount, occurred_at: new Date(NOW - 60_000 + secs * 1000).toISOString(), merchant });

describe('pairRecent', () => {
  it('links the two legs of a move between your accounts as a transfer, each pointing at the other', async () => {
    const { supabase, updates } = client({
      accounts: { data: accounts },
      transactions: { data: [tx('out', 'maya', -5_000, 0, 'BPI / VYBE by BPI'), tx('in', 'bpi', 5_000, 16, 'Maya Philippines, Inc.')] },
    });
    expect(await pairRecent(supabase, NOW)).toBe(1);
    expect(updates).toEqual([
      { payload: { kind: 'transfer', transfer_peer_id: 'in', category_id: null }, id: 'out' },
      { payload: { kind: 'transfer', transfer_peer_id: 'out', category_id: null }, id: 'in' },
    ]);
  });

  it('gives both legs the Transfer category when it exists', async () => {
    const { supabase, updates } = client({
      accounts: { data: accounts },
      transactions: { data: [tx('out', 'maya', -5_000, 0, 'BPI / VYBE by BPI'), tx('in', 'bpi', 5_000, 16, 'Maya Philippines, Inc.')] },
      categories: { data: { id: 'tcat' } },
    });
    await pairRecent(supabase, NOW);
    expect(updates).toEqual([
      { payload: { kind: 'transfer', transfer_peer_id: 'in', category_id: 'tcat' }, id: 'out' },
      { payload: { kind: 'transfer', transfer_peer_id: 'out', category_id: 'tcat' }, id: 'in' },
    ]);
  });

  it('leaves unrelated rows alone', async () => {
    const { supabase, updates } = client({
      accounts: { data: accounts },
      transactions: { data: [tx('out', 'maya', -5_000, 0, 'Jollibee'), tx('in', 'bpi', 5_000, 16, 'Salary')] },
    });
    expect(await pairRecent(supabase, NOW)).toBe(0);
    expect(updates).toEqual([]);
  });

  it('does nothing when it cannot read', async () => {
    const { supabase, updates } = client({ accounts: { error: { message: 'x' } }, transactions: { data: [] } });
    expect(await pairRecent(supabase, NOW)).toBe(0);
    expect(updates).toEqual([]);
  });
});
