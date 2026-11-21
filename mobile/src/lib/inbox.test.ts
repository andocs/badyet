import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { buildInbox, confirmTransaction, ignoreTransaction, type Row } from './inbox';

const ID = '11111111-1111-4111-8111-111111111111';
const PEER = '22222222-2222-4222-8222-222222222222';
const CAT = '33333333-3333-4333-8333-333333333333';

type Op = { name: string; args: unknown[] };
type Call = { table: string; ops: Op[] };
type Script = Record<string, { data?: unknown; error?: unknown }>;

/** A stand-in Supabase client: records every call and answers from `script` ("table:select" / "table:update" / "table:insert"). */
function fake(script: Script) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const ops: Op[] = [];
      const chain: unknown = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === 'then') {
              const kind = ops.find((o) => o.name === 'update' || o.name === 'insert')?.name ?? 'select';
              calls.push({ table, ops });
              return (resolve: (v: unknown) => void) => resolve({ data: null, error: null, ...script[table + ':' + kind] });
            }
            return (...args: unknown[]) => {
              ops.push({ name: prop, args });
              if (prop === 'maybeSingle') {
                calls.push({ table, ops });
                return Promise.resolve({ data: null, error: null, ...script[table + ':select'] });
              }
              return chain;
            };
          },
        },
      );
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const op = (calls: Call[], table: string, name: string) => calls.find((c) => c.table === table && c.ops.some((o) => o.name === name))?.ops.find((o) => o.name === name);
const updateOps = (calls: Call[]) => calls.find((c) => c.ops.some((o) => o.name === 'update'))?.ops ?? [];

const row = (over: Partial<Row>): Row => ({
  id: ID,
  account_id: 'a1',
  occurred_at: '2026-11-21T04:00:00Z',
  amount: -15_000,
  merchant: 'Jollibee',
  kind: 'expense',
  category_id: null,
  transfer_peer_id: null,
  source: 'notification',
  status: 'pending',
  note: null,
  ...over,
});

describe('buildInbox', () => {
  const cats = [{ id: 'c-food', name: 'Food' }, { id: 'c-fun', name: 'Fun' }];
  const accts = [{ id: 'a1', name: 'GCash' }, { id: 'a2', name: 'BPI' }];

  it('suggests from your rule first, then from history', () => {
    const rules = [{ id: 'r1', pattern: 'jolli', category_id: 'c-food', account_id: null, priority: 0 }];
    const hist = [{ merchant: 'Netflix', category_id: 'c-fun' }];
    const out = buildInbox([row({ id: 'x1' }), row({ id: 'x2', merchant: 'Netflix' }), row({ id: 'x3', merchant: 'Unknown' })], cats, accts, rules, hist);
    const by = Object.fromEntries(out.map((t) => [t.id, t]));
    expect(by.x1).toMatchObject({ guess: 'rule', categoryId: 'c-food', categoryName: 'Food' });
    expect(by.x2).toMatchObject({ guess: 'history', categoryId: 'c-fun' });
    expect(by.x3).toMatchObject({ guess: null, categoryId: null });
  });

  it('drops ignored rows, names transfers and shows the other account', () => {
    const out = buildInbox(
      [
        row({ id: 'gone', status: 'ignored' }),
        row({ id: 't1', kind: 'transfer', merchant: null, transfer_peer_id: 't2', amount: -5_000 }),
        row({ id: 't2', kind: 'transfer', merchant: null, account_id: 'a2', amount: 5_000 }),
      ],
      cats,
      accts,
      [],
      [],
    );
    expect(out.map((t) => t.id).sort()).toEqual(['t1', 't2']);
    expect(out.find((t) => t.id === 't1')).toMatchObject({ who: 'Transfer out', peerAccount: 'BPI' });
  });
});

describe('confirmTransaction', () => {
  const pending: Script = {
    'transactions:select': { data: { id: ID, kind: 'expense', status: 'pending', merchant: 'Jollibee', transfer_peer_id: null } },
    'categories:select': { data: { id: CAT } },
  };

  it('needs a category for a normal row and writes nothing without one', async () => {
    const { client, calls } = fake(pending);
    expect(await confirmTransaction(client, { id: ID, categoryId: null, rule: false, note: '' })).toEqual({ error: 'Pick a category first.' });
    expect(op(calls, 'transactions', 'update')).toBeUndefined();
  });

  it('confirms with category and a trimmed note, only while still pending', async () => {
    const { client, calls } = fake(pending);
    expect(await confirmTransaction(client, { id: ID, categoryId: CAT, rule: false, note: '  lunch  ' })).toEqual({ ok: true });
    const ops = updateOps(calls);
    expect(ops.find((o) => o.name === 'update')?.args[0]).toMatchObject({ status: 'confirmed', category_id: CAT, note: 'lunch' });
    expect(ops.find((o) => o.name === 'eq')?.args).toEqual(['status', 'pending']);
    expect(op(calls, 'merchant_rules', 'insert')).toBeUndefined();
  });

  it('saves a rule when asked and none exists', async () => {
    const { client, calls } = fake(pending);
    await confirmTransaction(client, { id: ID, categoryId: CAT, rule: true, note: '' });
    expect(op(calls, 'merchant_rules', 'insert')?.args[0]).toEqual({ pattern: 'Jollibee', category_id: CAT, priority: 0 });
  });

  it('does not duplicate a rule that already exists', async () => {
    const { client, calls } = fake({ ...pending, 'merchant_rules:select': { data: { id: 'r1' } } });
    await confirmTransaction(client, { id: ID, categoryId: CAT, rule: true, note: '' });
    expect(op(calls, 'merchant_rules', 'insert')).toBeUndefined();
  });

  it('confirms both legs of a transfer without a category', async () => {
    const { client, calls } = fake({
      'transactions:select': { data: { id: ID, kind: 'transfer', status: 'pending', merchant: null, transfer_peer_id: PEER } },
    });
    expect(await confirmTransaction(client, { id: ID, categoryId: null, rule: true, note: '' })).toEqual({ ok: true });
    const ops = updateOps(calls);
    expect(ops.find((o) => o.name === 'in')?.args).toEqual(['id', [ID, PEER]]);
    expect(ops.find((o) => o.name === 'update')?.args[0]).toMatchObject({ category_id: null });
  });

  it('refuses something no longer pending or not a valid id', async () => {
    const { client } = fake({
      'transactions:select': { data: { id: ID, kind: 'expense', status: 'confirmed', merchant: 'x', transfer_peer_id: null } },
    });
    expect(await confirmTransaction(client, { id: ID, categoryId: CAT, rule: false, note: '' })).toEqual({ error: 'That one is no longer waiting.' });
    expect(await confirmTransaction(client, { id: 'nope', categoryId: CAT, rule: false, note: '' })).toEqual({ error: 'That transaction was not found.' });
  });
});

describe('ignoreTransaction', () => {
  it('ignores a pending row and its transfer peer', async () => {
    const { client, calls } = fake({
      'transactions:select': { data: { id: ID, kind: 'transfer', status: 'pending', transfer_peer_id: PEER } },
    });
    expect(await ignoreTransaction(client, ID)).toEqual({ ok: true });
    const ops = updateOps(calls);
    expect(ops.find((o) => o.name === 'update')?.args[0]).toEqual({ status: 'ignored' });
    expect(ops.find((o) => o.name === 'in')?.args).toEqual(['id', [ID, PEER]]);
  });

  it('leaves a row that is no longer pending alone', async () => {
    const { client, calls } = fake({
      'transactions:select': { data: { id: ID, kind: 'expense', status: 'ignored', transfer_peer_id: null } },
    });
    expect(await ignoreTransaction(client, ID)).toEqual({ error: 'That one is no longer waiting.' });
    expect(updateOps(calls)).toEqual([]);
  });
});
