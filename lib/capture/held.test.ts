import { describe, expect, it } from 'vitest';
import { client, find } from '../../mobile/src/lib/fakeClient';
import { buildRow } from './row';
import { confirmedRow, heldToRow, parsedOf, resolveHeldRow, type HeldRow } from './held';
import type { Parsed } from './parsers';

const ACC = '22222222-2222-4222-8222-222222222222';
const CAT = '44444444-4444-4444-8444-444444444444';
const accounts = [{ id: ACC, name: 'Maya', institution: null, last4: null }];
const parsed: Parsed = { source: 'maya', direction: 'in', amount: 10_000, counterparty: 'Juan D', counterpartyLast4: null, accountHint: null, ref: 'AB12', accountName: null };
const row: HeldRow = heldToRow({ parsed, postTime: Date.parse('2026-11-22T04:00:00Z'), hash: 'abcdef123456', origin: 'notification' });

describe('held capture rows', () => {
  it('keep only what the parser read, and turn back into the same capture', () => {
    expect(row).toMatchObject({ hash: 'abcdef123456', source: 'maya', direction: 'in', amount: 10_000, counterparty: 'Juan D', ref: 'AB12', post_time: '2026-11-22T04:00:00.000Z', origin: 'notification' });
    expect(parsedOf(row)).toEqual(parsed);
    expect(parsedOf({ ...row, source: 'nope' })).toBeNull();
  });
});

describe('confirmedRow', () => {
  const base = buildRow({
    id: 'r1', parsed, decision: { keep: true, status: 'pending', accountId: ACC, categoryId: null, ruleId: null }, accountId: ACC, postTime: Date.parse('2026-11-22T04:00:00Z'), hash: 'abcdef123456',
  });
  it('confirms under the chosen category', () => {
    expect(confirmedRow(base, { transfer: false, categoryId: CAT, transferCategoryId: null, at: '2026-11-22T05:00:00.000Z' })).toMatchObject({ kind: 'income', category_id: CAT, status: 'confirmed', confirmed_at: '2026-11-22T05:00:00.000Z' });
  });
  it('makes a move between your own accounts a confirmed transfer in the Transfer category', () => {
    expect(confirmedRow(base, { transfer: true, categoryId: CAT, transferCategoryId: 'tcat', at: 'x' })).toMatchObject({ kind: 'transfer', category_id: 'tcat', status: 'confirmed' });
  });
});

describe('resolveHeldRow', () => {
  it('confirms at once in the chosen account under the chosen category, and clears the held one', async () => {
    const { supabase, log } = client({ 'held_captures:select': { data: row }, 'accounts:select': { data: accounts }, 'categories:select': { data: { id: CAT } } });
    expect(await resolveHeldRow(supabase, { hash: row.hash, accountId: ACC, categoryId: CAT })).toEqual({ ok: true });
    expect(find(log, 'transactions', 'insert')?.args[0]).toMatchObject({
      account_id: ACC, amount: 10_000, kind: 'income', category_id: CAT, status: 'confirmed', dedupe_hash: 'abcdef123456', merchant: 'Juan D', source: 'notification',
    });
    expect((find(log, 'transactions', 'insert')?.args[0] as { confirmed_at: string | null }).confirmed_at).toBeTruthy();
    expect(find(log, 'held_captures', 'delete')).toBeDefined();
  });
  it('confirms a move to one of your own accounts as a transfer, with no category needed', async () => {
    const { supabase, log } = client({ 'held_captures:select': { data: row }, 'accounts:select': { data: accounts }, 'categories:select': { data: { id: 'tcat' } } });
    expect(await resolveHeldRow(supabase, { hash: row.hash, accountId: ACC, otherName: 'BPI Payroll' })).toEqual({ ok: true });
    expect(find(log, 'transactions', 'insert')?.args[0]).toMatchObject({ kind: 'transfer', merchant: 'BPI Payroll', category_id: 'tcat', status: 'confirmed' });
  });
  it('asks for a category when the other side is not your own account', async () => {
    const { supabase, log } = client({ 'held_captures:select': { data: row }, 'accounts:select': { data: accounts } });
    expect(await resolveHeldRow(supabase, { hash: row.hash, accountId: ACC })).toMatchObject({ error: expect.stringMatching(/Pick a category/) });
    expect(find(log, 'transactions', 'insert')).toBeUndefined();
    expect(find(log, 'held_captures', 'delete')).toBeUndefined();
  });
  it('refuses a category that does not exist', async () => {
    const { supabase, log } = client({ 'held_captures:select': { data: row }, 'accounts:select': { data: accounts }, 'categories:select': { data: null } });
    expect(await resolveHeldRow(supabase, { hash: row.hash, accountId: ACC, categoryId: CAT })).toMatchObject({ error: expect.stringMatching(/category was not found/) });
    expect(find(log, 'transactions', 'insert')).toBeUndefined();
  });
  it('drops it with no account, without adding anything', async () => {
    const { supabase, log } = client({ 'held_captures:select': { data: row } });
    expect(await resolveHeldRow(supabase, { hash: row.hash, accountId: null })).toEqual({ ok: true });
    expect(find(log, 'transactions', 'insert')).toBeUndefined();
    expect(find(log, 'held_captures', 'delete')).toBeDefined();
  });
  it('treats one already answered as done, and a repeat insert as already added', async () => {
    const gone = client({ 'held_captures:select': { data: null } });
    expect(await resolveHeldRow(gone.supabase, { hash: 'zzzzzzzz', accountId: ACC, categoryId: CAT })).toMatchObject({ ok: true });
    const dup = client({ 'held_captures:select': { data: row }, 'accounts:select': { data: accounts }, 'categories:select': { data: { id: CAT } }, 'transactions:insert': { error: { code: '23505' } } });
    expect(await resolveHeldRow(dup.supabase, { hash: row.hash, accountId: ACC, categoryId: CAT })).toEqual({ ok: true });
    expect(find(dup.log, 'held_captures', 'delete')).toBeDefined();
  });
  it('refuses an account that does not exist', async () => {
    const { supabase, log } = client({ 'held_captures:select': { data: row }, 'accounts:select': { data: null } });
    expect(await resolveHeldRow(supabase, { hash: row.hash, accountId: ACC, categoryId: CAT })).toMatchObject({ error: expect.stringMatching(/not found/) });
    expect(find(log, 'transactions', 'insert')).toBeUndefined();
  });
});
