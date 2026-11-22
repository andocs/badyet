import { describe, expect, it } from 'vitest';
import { client, find } from '../../mobile/src/lib/fakeClient';
import { heldToRow, parsedOf, resolveHeldRow, type HeldRow } from './held';
import type { Parsed } from './parsers';

const ACC = '22222222-2222-4222-8222-222222222222';
const parsed: Parsed = { source: 'maya', direction: 'in', amount: 10_000, counterparty: 'Juan D', counterpartyLast4: null, accountHint: null, ref: 'AB12', accountName: null };
const row: HeldRow = heldToRow({ parsed, postTime: Date.parse('2026-11-22T04:00:00Z'), hash: 'abcdef123456', origin: 'notification' });

describe('held capture rows', () => {
  it('keep only what the parser read, and turn back into the same capture', () => {
    expect(row).toMatchObject({ hash: 'abcdef123456', source: 'maya', direction: 'in', amount: 10_000, counterparty: 'Juan D', ref: 'AB12', post_time: '2026-11-22T04:00:00.000Z', origin: 'notification' });
    expect(parsedOf(row)).toEqual(parsed);
    expect(parsedOf({ ...row, source: 'nope' })).toBeNull();
  });
});

describe('resolveHeldRow', () => {
  it('adds a pending row to the chosen account and clears the held one', async () => {
    const { supabase, log } = client({ 'held_captures:select': { data: row }, 'accounts:select': { data: [{ id: ACC, name: 'Maya', institution: null, last4: null }] } });
    expect(await resolveHeldRow(supabase, { hash: row.hash, accountId: ACC })).toEqual({ ok: true });
    expect(find(log, 'transactions', 'insert')?.args[0]).toMatchObject({ account_id: ACC, amount: 10_000, kind: 'income', status: 'pending', dedupe_hash: 'abcdef123456', merchant: 'Juan D', source: 'notification' });
    expect(find(log, 'held_captures', 'delete')).toBeDefined();
  });
  it('names the other account when the other side is also yours', async () => {
    const { supabase, log } = client({ 'held_captures:select': { data: row }, 'accounts:select': { data: [{ id: ACC, name: 'Maya', institution: null, last4: null }] } });
    await resolveHeldRow(supabase, { hash: row.hash, accountId: ACC, otherName: 'BPI Payroll' });
    expect(find(log, 'transactions', 'insert')?.args[0]).toMatchObject({ merchant: 'BPI Payroll' });
  });
  it('drops it with no account, without adding anything', async () => {
    const { supabase, log } = client({ 'held_captures:select': { data: row } });
    expect(await resolveHeldRow(supabase, { hash: row.hash, accountId: null })).toEqual({ ok: true });
    expect(find(log, 'transactions', 'insert')).toBeUndefined();
    expect(find(log, 'held_captures', 'delete')).toBeDefined();
  });
  it('treats one already answered as done, and a repeat insert as already added', async () => {
    const gone = client({ 'held_captures:select': { data: null } });
    expect(await resolveHeldRow(gone.supabase, { hash: 'zzzzzzzz', accountId: ACC })).toMatchObject({ ok: true });
    const dup = client({ 'held_captures:select': { data: row }, 'accounts:select': { data: [{ id: ACC, name: 'Maya', institution: null, last4: null }] }, 'transactions:insert': { error: { code: '23505' } } });
    expect(await resolveHeldRow(dup.supabase, { hash: row.hash, accountId: ACC })).toEqual({ ok: true });
    expect(find(dup.log, 'held_captures', 'delete')).toBeDefined();
  });
  it('refuses an account that does not exist', async () => {
    const { supabase, log } = client({ 'held_captures:select': { data: row }, 'accounts:select': { data: null } });
    expect(await resolveHeldRow(supabase, { hash: row.hash, accountId: ACC })).toMatchObject({ error: expect.stringMatching(/not found/) });
    expect(find(log, 'transactions', 'insert')).toBeUndefined();
  });
});
