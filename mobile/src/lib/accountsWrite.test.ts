import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { addAccount, editAccount, moveMoney, reconcileAccount } from './accountsWrite';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

type Answer = { data?: unknown; error?: unknown };
type Op = { name: string; args: unknown[] };

/** Stand-in client: every query ends in `answers["table:op"]` (op = insert, update, delete or select); every call is recorded. */
function client(answers: Record<string, Answer>) {
  const log: { table: string; ops: Op[] }[] = [];
  const c = {
    from(table: string) {
      const ops: Op[] = [];
      const key = () => table + ':' + (ops.find((o) => ['insert', 'update', 'delete'].includes(o.name))?.name ?? 'select');
      const make = (): unknown =>
        new Proxy({}, {
          get(_t, prop: string) {
            if (prop === 'then') {
              log.push({ table, ops });
              return (resolve: (v: unknown) => void) => resolve({ data: null, error: null, ...answers[key()] });
            }
            return (...args: unknown[]) => {
              ops.push({ name: prop, args });
              if (prop === 'maybeSingle' || prop === 'single') {
                log.push({ table, ops });
                return Promise.resolve({ data: null, error: null, ...answers[key()] });
              }
              return make();
            };
          },
        });
      return make();
    },
  };
  return { supabase: c as unknown as SupabaseClient, log };
}
const find = (log: { table: string; ops: Op[] }[], table: string, name: string) => log.find((e) => e.table === table && e.ops.some((o) => o.name === name))?.ops.find((o) => o.name === name);

describe('addAccount', () => {
  it('rejects a bad form before touching the database', async () => {
    const { supabase, log } = client({});
    expect(await addAccount(supabase, { name: '', kind: 'debit' })).toHaveProperty('error');
    expect(log).toHaveLength(0);
  });
  it('inserts the account then its opening anchor', async () => {
    const { supabase, log } = client({ 'accounts:insert': { data: { id: A } } });
    expect(await addAccount(supabase, { name: ' Bank ', kind: 'debit', opening: '1,000' })).toEqual({ ok: true });
    expect(find(log, 'accounts', 'insert')?.args[0]).toMatchObject({ name: 'Bank', kind: 'debit' });
    expect(find(log, 'balance_anchors', 'insert')?.args[0]).toMatchObject({ account_id: A, amount: 100_000, source: 'wizard' });
  });
  it('stores a card balance as what you owe, negative', async () => {
    const { supabase, log } = client({ 'accounts:insert': { data: { id: A } } });
    await addAccount(supabase, { name: 'Card', kind: 'credit', opening: '2,500' });
    expect(find(log, 'balance_anchors', 'insert')?.args[0]).toMatchObject({ amount: -250_000 });
  });
  it('says so when the name is taken', async () => {
    const { supabase } = client({ 'accounts:insert': { error: { code: '23505' } } });
    expect(await addAccount(supabase, { name: 'Bank', kind: 'debit' })).toEqual({ error: 'You already have an account with that name.' });
  });
});

describe('reconcileAccount', () => {
  it('writes a reconcile anchor in the account sign convention', async () => {
    const { supabase, log } = client({ 'accounts:select': { data: { id: A, kind: 'credit' } } });
    expect(await reconcileAccount(supabase, { accountId: A, balance: '1,250.50' })).toEqual({ ok: true });
    expect(find(log, 'balance_anchors', 'insert')?.args[0]).toMatchObject({ account_id: A, amount: -125_050, source: 'reconcile' });
  });
  it('rejects bad input and unknown accounts', async () => {
    const { supabase } = client({});
    expect(await reconcileAccount(supabase, { accountId: 'x', balance: '5' })).toHaveProperty('error');
    expect(await reconcileAccount(supabase, { accountId: A, balance: 'abc' })).toHaveProperty('error');
    expect(await reconcileAccount(supabase, { accountId: A, balance: '5' })).toEqual({ error: 'That account was not found.' });
  });
});

describe('moveMoney', () => {
  it('rejects the same account, zero and missing accounts', async () => {
    const { supabase } = client({});
    expect(await moveMoney(supabase, { from: A, to: A, amount: '5' })).toHaveProperty('error');
    expect(await moveMoney(supabase, { from: A, to: B, amount: '0' })).toHaveProperty('error');
    expect(await moveMoney(supabase, { from: A, to: B, amount: '5' })).toEqual({ error: 'One of those accounts was not found.' });
  });
  it('writes two confirmed transfer rows and links them', async () => {
    const { supabase, log } = client({
      'accounts:select': { data: [{ id: A }, { id: B }] },
      'transactions:insert': { data: [{ id: 'o', account_id: A }, { id: 'i', account_id: B }] },
    });
    expect(await moveMoney(supabase, { from: A, to: B, amount: '300' })).toEqual({ ok: true });
    const rows = find(log, 'transactions', 'insert')?.args[0] as { account_id: string; amount: number; kind: string; status: string }[];
    expect(rows.map((r) => [r.account_id, r.amount, r.kind, r.status])).toEqual([[A, -30_000, 'transfer', 'confirmed'], [B, 30_000, 'transfer', 'confirmed']]);
    const updates = log.filter((e) => e.table === 'transactions' && e.ops.some((o) => o.name === 'update')).map((e) => e.ops.find((o) => o.name === 'update')!.args[0]);
    expect(updates).toEqual([{ transfer_peer_id: 'i' }, { transfer_peer_id: 'o' }]);
  });
});

describe('editAccount', () => {
  it('updates name, bank, last four and colour only', async () => {
    const { supabase, log } = client({});
    expect(await editAccount(supabase, { id: A, name: ' Main ', institution: ' BPI ', last4: '1234', color: '#087A5A' })).toEqual({ ok: true });
    expect(find(log, 'accounts', 'update')?.args[0]).toEqual({ name: 'Main', institution: 'BPI', last4: '1234', color: '#087A5A' });
  });
  it('rejects a full card number', async () => {
    const { supabase } = client({});
    expect(await editAccount(supabase, { id: A, name: 'Main', last4: '1234567', color: '#087A5A' })).toHaveProperty('error');
  });
});
