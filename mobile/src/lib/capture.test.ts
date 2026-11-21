import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { addRule, loadCapture, saveSource } from './capture';

const ACC = '22222222-2222-4222-8222-222222222222';
const CAT = '33333333-3333-4333-8333-333333333333';
const USER = '99999999-9999-4999-8999-999999999999';

type Answer = { data?: unknown; error?: { code?: string; message?: string } | null };

/** Stand-in client: every query ends in `answers[table]`; upsert and insert payloads are recorded. */
function client(answers: Record<string, Answer>) {
  const writes: { table: string; op: string; payload: unknown; opts?: unknown }[] = [];
  const c = {
    from(table: string) {
      const make = (): unknown =>
        new Proxy(
          {},
          {
            get(_t, prop: string) {
              if (prop === 'then') return (resolve: (v: unknown) => void) => resolve({ data: null, error: null, ...answers[table] });
              if (prop === 'maybeSingle') return () => Promise.resolve({ data: null, error: null, ...answers[table] });
              if (prop === 'upsert' || prop === 'insert') {
                return (payload: unknown, opts?: unknown) => {
                  writes.push({ table, op: prop, payload, opts });
                  return make();
                };
              }
              return () => make();
            },
          },
        );
      return make();
    },
  };
  return { supabase: c as unknown as SupabaseClient, writes };
}

const input = { source: 'gcash', enabled: true, packages: 'com.globe.gcash.android', senders: '', accountId: ACC, categoryId: CAT, autoConfirm: false, minAmount: '50' };

describe('saveSource', () => {
  it('upserts one row per user and source, with the minimum in centavos', async () => {
    const { supabase, writes } = client({ accounts: { data: { id: ACC } }, categories: { data: { id: CAT } } });
    expect(await saveSource(supabase, USER, input)).toEqual({ ok: true });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ table: 'capture_sources', op: 'upsert', opts: { onConflict: 'user_id,source' } });
    expect(writes[0]!.payload).toMatchObject({ user_id: USER, source: 'gcash', packages: ['com.globe.gcash.android'], account_id: ACC, category_id: CAT, min_amount: 5000 });
  });

  it('rejects bad input before touching the database', async () => {
    const { supabase, writes } = client({});
    expect(await saveSource(supabase, USER, { ...input, packages: 'nonsense' })).toEqual({ error: 'An app id looks like com.example.app.' });
    expect(writes).toHaveLength(0);
  });

  it('refuses an account or category that does not exist', async () => {
    const { supabase, writes } = client({ accounts: { data: null }, categories: { data: { id: CAT } } });
    expect(await saveSource(supabase, USER, input)).toEqual({ error: 'That account was not found.' });
    expect(writes).toHaveLength(0);
  });

  it('reports a failed save without leaking the database message', async () => {
    const { supabase } = client({ accounts: { data: { id: ACC } }, categories: { data: { id: CAT } }, capture_sources: { error: { message: 'secret detail' } } });
    expect(await saveSource(supabase, USER, input)).toEqual({ error: 'That did not save. Try again.' });
  });
});

describe('addRule', () => {
  it('inserts a validated keyword rule', async () => {
    const { supabase, writes } = client({ categories: { data: { id: CAT } } });
    expect(await addRule(supabase, { source: null, matchText: '  cash  back ', action: 'set_category', categoryId: CAT })).toEqual({ ok: true });
    expect(writes[0]).toMatchObject({ table: 'capture_rules', op: 'insert', payload: { source: null, match_text: 'cash back', action: 'set_category', category_id: CAT } });
  });
  it('needs a category for set_category', async () => {
    const { supabase, writes } = client({});
    expect(await addRule(supabase, { source: null, matchText: 'x', action: 'set_category', categoryId: null })).toEqual({ error: 'Pick a category.' });
    expect(writes).toHaveLength(0);
  });
});

describe('loadCapture', () => {
  it('says so when the migration has not been applied, and falls back to the defaults', async () => {
    const { supabase } = client({ capture_sources: { error: { code: 'PGRST205' } }, capture_rules: { data: [] } });
    const d = await loadCapture(supabase);
    expect(d.missing).toBe(true);
    expect(d.configs).toHaveLength(8);
    expect(d.rules).toEqual([]);
  });
  it('reads saved rows over the defaults', async () => {
    const { supabase } = client({
      capture_sources: { data: [{ source: 'maya', enabled: false, packages: [], senders: [], account_id: null, category_id: null, auto_confirm: false, min_amount: 0 }] },
      capture_rules: { data: [{ id: '1', source: null, match_text: 'cashback', action: 'ignore', category_id: null }] },
    });
    const d = await loadCapture(supabase);
    expect(d.missing).toBe(false);
    expect(d.configs.find((x) => x.source === 'maya')?.enabled).toBe(false);
    expect(d.rules).toEqual([{ id: '1', source: null, matchText: 'cashback', action: 'ignore', categoryId: null }]);
  });
});
