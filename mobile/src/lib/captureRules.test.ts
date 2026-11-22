import { describe, expect, it } from 'vitest';
import { deleteRule, loadCapture, moveRule, saveDedupeRule, saveRuleFull, setRuleEnabled } from './capture';
import { client, find } from './fakeClient';

const ACC = '22222222-2222-4222-8222-222222222222';
const ACC2 = '44444444-4444-4444-8444-444444444444';
const CAT = '33333333-3333-4333-8333-333333333333';
const USER = '99999999-9999-4999-8999-999999999999';

const input = {
  name: 'Cashback', enabled: true, channel: 'both', words: ['Cashback'], mustWords: [], skipWords: [], sources: ['gcash'], packages: [], senders: [],
  action: 'record', kind: 'spending', categoryId: CAT, fromAccountId: null, toAccountId: null, autoConfirm: false,
};

describe('saveRuleFull', () => {
  it('inserts a new rule at the bottom', async () => {
    const { supabase, log } = client({ 'categories:select': { data: { id: CAT } }, 'capture_rules:select': { data: { position: 4 } } });
    expect(await saveRuleFull(supabase, null, input)).toEqual({ ok: true });
    expect(find(log, 'capture_rules', 'insert')?.args[0]).toMatchObject({ name: 'Cashback', words: ['cashback'], match_text: 'cashback', kind: 'spending', category_id: CAT, position: 5 });
  });
  it('updates an existing rule', async () => {
    const { supabase, log } = client({ 'categories:select': { data: { id: CAT } } });
    expect(await saveRuleFull(supabase, 'r1', input)).toEqual({ ok: true });
    expect(find(log, 'capture_rules', 'update')?.args[0]).toMatchObject({ name: 'Cashback' });
    expect(find(log, 'capture_rules', 'eq')?.args).toEqual(['id', 'r1']);
  });
  it('rejects bad input without touching the database', async () => {
    const { supabase, log } = client({});
    expect(await saveRuleFull(supabase, null, { ...input, words: [] })).toEqual({ error: 'Add at least one word to look for.' });
    expect(log).toHaveLength(0);
  });
  it('refuses a category or account that is missing or archived', async () => {
    const a = client({ 'categories:select': { data: null } });
    expect(await saveRuleFull(a.supabase, null, input)).toEqual({ error: 'That category was not found.' });
    const b = client({ 'accounts:select': { data: null } });
    expect(await saveRuleFull(b.supabase, null, { ...input, kind: 'transfer', categoryId: null, fromAccountId: ACC, toAccountId: ACC2 })).toEqual({ error: 'That account was not found.' });
    expect(find(b.log, 'capture_rules', 'insert')).toBeUndefined();
  });
  it('hides a database failure', async () => {
    const { supabase } = client({ 'categories:select': { data: { id: CAT } }, 'capture_rules:insert': { error: { message: 'secret' } } });
    expect(await saveRuleFull(supabase, null, input)).toEqual({ error: 'That did not save. Try again.' });
  });
});

describe('setRuleEnabled and deleteRule', () => {
  it('switches a rule on or off', async () => {
    const { supabase, log } = client({});
    expect(await setRuleEnabled(supabase, 'r1', false)).toEqual({ ok: true });
    expect(find(log, 'capture_rules', 'update')?.args[0]).toEqual({ enabled: false });
  });
  it('deletes a rule', async () => {
    const { supabase, log } = client({});
    expect(await deleteRule(supabase, 'r1')).toEqual({ ok: true });
    expect(find(log, 'capture_rules', 'delete')).toBeDefined();
  });
});

describe('moveRule', () => {
  const list = [{ id: 'a', position: 0 }, { id: 'b', position: 0 }, { id: 'c', position: 0 }];
  it('swaps with the neighbour and renumbers', async () => {
    const { supabase, log } = client({});
    expect(await moveRule(supabase, list, 'b', -1)).toEqual({ ok: true });
    const updates = log.filter((e) => e.ops.some((o) => o.name === 'update')).map((e) => [e.ops.find((o) => o.name === 'update')!.args[0], e.ops.find((o) => o.name === 'eq')!.args[1]]);
    expect(updates).toEqual([[{ position: 1 }, 'a'], [{ position: 2 }, 'c']]);
  });
  it('does nothing at the ends', async () => {
    const { supabase, log } = client({});
    expect(await moveRule(supabase, list, 'a', -1)).toEqual({ ok: true });
    expect(log).toHaveLength(0);
  });
});

describe('saveDedupeRule', () => {
  it('upserts one row per user', async () => {
    const { supabase, log } = client({});
    expect(await saveDedupeRule(supabase, USER, { windowMin: 90, matchSource: true })).toEqual({ ok: true });
    const up = find(log, 'dedupe_rules', 'upsert');
    expect(up?.args[0]).toEqual({ user_id: USER, window_minutes: 90, match_source: true });
    expect(up?.args[1]).toEqual({ onConflict: 'user_id' });
  });
  it('keeps the window between 1 and 240 minutes', async () => {
    const { supabase, log } = client({});
    expect(await saveDedupeRule(supabase, USER, { windowMin: 0, matchSource: false })).toHaveProperty('error');
    expect(await saveDedupeRule(supabase, USER, { windowMin: 241, matchSource: false })).toHaveProperty('error');
    expect(log).toHaveLength(0);
  });
});

describe('loadCapture rule columns', () => {
  it('falls back to the old columns when the database has no new ones (42703)', async () => {
    let n = 0;
    // The first rules query fails with 42703; the retry answers with an old-style row.
    const answer = {
      get error() { return n++ === 0 ? { code: '42703' } : null; },
      get data() { return n === 1 ? null : [{ id: '1', source: null, match_text: 'x', action: 'ignore', category_id: null }]; },
    };
    const { supabase } = client({ 'capture_rules:select': answer as never });
    const d = await loadCapture(supabase);
    expect(d.rules).toMatchObject([{ id: '1', matchText: 'x', enabled: true, channel: 'both' }]);
  });
});
