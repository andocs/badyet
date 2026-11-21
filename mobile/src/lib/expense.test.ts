import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { buildExpense, flushQueue, type ExpenseRow, type QueueStore, type Queued } from './expense';

const ID = '11111111-1111-4111-8111-111111111111';
const ACC = '22222222-2222-4222-8222-222222222222';
const CAT = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-11-21T13:30:00.000Z');

const input = (over: Partial<Parameters<typeof buildExpense>[0]> = {}) => ({ id: ID, amountText: '250', merchant: 'Jollibee', accountId: ACC, categoryId: CAT, ...over });

describe('buildExpense', () => {
  it('builds the same row the web action inserts, with the entry time', () => {
    const r = buildExpense(input({ amountText: '1,250.50', merchant: '  Jollibee  ' }), NOW);
    expect(r).toEqual({
      ok: true,
      row: {
        id: ID, account_id: ACC, occurred_at: NOW.toISOString(), amount: -125_050, merchant: 'Jollibee', kind: 'expense',
        category_id: CAT, source: 'manual', status: 'confirmed', confirmed_at: NOW.toISOString(),
      },
    });
  });

  it('allows no category and no merchant', () => {
    const r = buildExpense(input({ categoryId: null, merchant: '   ' }), NOW);
    expect(r).toMatchObject({ ok: true, row: { category_id: null, merchant: null } });
  });

  it('keeps the merchant to 80 characters', () => {
    const r = buildExpense(input({ merchant: 'x'.repeat(120) }), NOW);
    expect(r).toMatchObject({ ok: true });
    expect((r as { row: ExpenseRow }).row.merchant).toHaveLength(80);
  });

  it.each(['', '0', '-5', 'abc', '1.234', '1,25'])('rejects the amount %j', (amountText) => {
    expect(buildExpense(input({ amountText }), NOW)).toEqual({ error: 'Enter an amount above zero, like 250 or 1,250.50.' });
  });

  it('rejects an amount over the database limit', () => {
    expect(buildExpense(input({ amountText: '1,000,000,001' }), NOW)).toEqual({ error: 'That amount is too large.' });
  });

  it('needs a valid account and a valid category if one is given', () => {
    expect(buildExpense(input({ accountId: null }), NOW)).toEqual({ error: 'Pick an account.' });
    expect(buildExpense(input({ accountId: 'nope' }), NOW)).toEqual({ error: 'Pick an account.' });
    expect(buildExpense(input({ categoryId: 'nope' }), NOW)).toEqual({ error: 'Pick a category from the list.' });
  });
});

function memoryStore(rows: ExpenseRow[]): QueueStore & { items: Queued[] } {
  const items: Queued[] = rows.map((row) => ({ row, tries: 0, lastError: null }));
  return {
    items,
    all: async () => items.map((q) => ({ ...q })),
    add: async (row) => void items.push({ row, tries: 0, lastError: null }),
    remove: async (id) => void items.splice(items.findIndex((q) => q.row.id === id), 1),
    fail: async (id, message) => {
      const q = items.find((x) => x.row.id === id)!;
      q.tries += 1;
      q.lastError = message;
    },
  };
}

const rowOf = (n: number): ExpenseRow => {
  const b = buildExpense(input({ id: `0000000${n}-1111-4111-8111-111111111111` }), NOW);
  if ('error' in b) throw new Error(b.error);
  return b.row;
};

/** A stand-in client whose upsert answers from `answers` (one per call) and records what it was sent. */
function upsertClient(answers: ({ code?: string; message: string } | null)[]) {
  const sent: { row: ExpenseRow; opts: unknown }[] = [];
  const client = {
    from: (table: string) => ({
      upsert: async (row: ExpenseRow, opts: unknown) => {
        expect(table).toBe('transactions');
        sent.push({ row, opts });
        return { error: answers[sent.length - 1] ?? null };
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, sent };
}

describe('flushQueue', () => {
  it('sends everything oldest first, ignoring duplicates, and empties the queue', async () => {
    const store = memoryStore([rowOf(1), rowOf(2)]);
    const { client, sent } = upsertClient([null, null]);
    expect(await flushQueue(store, client)).toEqual({ sent: 2, left: 0 });
    expect(sent.map((s) => s.row.id)).toEqual([rowOf(1).id, rowOf(2).id]);
    expect(sent[0]!.opts).toEqual({ onConflict: 'id', ignoreDuplicates: true });
  });

  it('on a network failure keeps everything and stops', async () => {
    const store = memoryStore([rowOf(1), rowOf(2)]);
    const { client, sent } = upsertClient([{ message: 'TypeError: Network request failed' }]);
    expect(await flushQueue(store, client)).toEqual({ sent: 0, left: 2 });
    expect(sent).toHaveLength(1);
    expect(store.items.every((q) => q.lastError === null)).toBe(true);
  });

  it('on an expired login keeps the row and does not mark it failed', async () => {
    const store = memoryStore([rowOf(1)]);
    const { client } = upsertClient([{ code: 'PGRST301', message: 'JWT expired' }]);
    expect(await flushQueue(store, client)).toEqual({ sent: 0, left: 1 });
    expect(store.items[0]!.lastError).toBeNull();
  });

  it('marks a rejected row and carries on with the rest', async () => {
    const store = memoryStore([rowOf(1), rowOf(2)]);
    const { client } = upsertClient([{ code: '23514', message: 'amount out of range' }, null]);
    expect(await flushQueue(store, client)).toEqual({ sent: 1, left: 1 });
    expect(store.items[0]).toMatchObject({ tries: 1, lastError: 'amount out of range' });
  });

  it('sending the same row twice sends the same id both times, so the server can ignore the repeat', async () => {
    const store = memoryStore([rowOf(1)]);
    const first = upsertClient([{ message: 'Network request failed' }]);
    await flushQueue(store, first.client);
    const second = upsertClient([null]);
    await flushQueue(store, second.client);
    expect(first.sent[0]!.row.id).toBe(second.sent[0]!.row.id);
    expect(store.items).toHaveLength(0);
  });
});
