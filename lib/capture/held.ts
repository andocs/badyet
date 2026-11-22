import type { SupabaseClient } from '@supabase/supabase-js';
import type { Parsed } from './parsers';
import { isSource } from './sources';
import { buildRow } from './row';
import { pairRecent } from './pairing';

/** A held capture as stored in the held_captures table. */
export interface HeldRow {
  hash: string;
  source: string;
  direction: 'in' | 'out';
  amount: number;
  counterparty: string | null;
  counterparty_last4: string | null;
  account_hint: string | null;
  account_name: string | null;
  ref: string | null;
  post_time: string;
  origin: 'notification' | 'import';
}

export const HELD_COLUMNS = 'hash, source, direction, amount, counterparty, counterparty_last4, account_hint, account_name, ref, post_time, origin';

/** What the phone keeps for a held capture, as the row to store (no notification text is involved). */
export function heldToRow(h: { parsed: Parsed; postTime: number; hash: string; origin?: 'notification' | 'import' }): HeldRow {
  const p = h.parsed;
  return {
    hash: h.hash, source: p.source, direction: p.direction, amount: p.amount,
    counterparty: p.counterparty, counterparty_last4: p.counterpartyLast4, account_hint: p.accountHint, account_name: p.accountName, ref: p.ref,
    post_time: new Date(h.postTime).toISOString(), origin: h.origin ?? 'notification',
  };
}

/** The parsed capture a stored row stands for, or null when it names a source this app does not know. */
export function parsedOf(r: HeldRow): Parsed | null {
  if (!isSource(r.source)) return null;
  return {
    source: r.source, direction: r.direction, amount: r.amount, counterparty: r.counterparty, counterpartyLast4: r.counterparty_last4,
    accountHint: r.account_hint, ref: r.ref, accountName: r.account_name,
  };
}

export type Result = { ok: true; note?: string } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Answers a held capture. With an account it becomes a pending row in that account (naming the other account when the other side is
 * also yours, so the pairing can make it a transfer); with null it is dropped. Either way the held row goes. A capture already added
 * (same hash) is not added twice.
 */
export async function resolveHeldRow(supabase: SupabaseClient, input: { hash: string; accountId: string | null; otherName?: string | null }): Promise<Result> {
  const found = await supabase.from('held_captures').select(HELD_COLUMNS).eq('hash', input.hash).maybeSingle();
  if (found.error) return { error: 'Could not read that capture. Try again.' };
  const held = found.data as HeldRow | null;
  if (!held) return { ok: true, note: 'That one was already answered.' };

  if (input.accountId) {
    if (!UUID.test(input.accountId)) return { error: 'Pick an account from the list.' };
    const acct = await supabase.from('accounts').select('id').eq('id', input.accountId).is('archived_at', null).maybeSingle();
    if (!acct.data) return { error: 'That account was not found.' };
    const parsed = parsedOf(held);
    if (!parsed) return { error: 'That capture is from a source this app does not know.' };
    const postTime = Date.parse(held.post_time);
    const row = buildRow({
      id: crypto.randomUUID(),
      parsed: input.otherName ? { ...parsed, counterparty: input.otherName } : parsed,
      decision: { keep: true, status: 'pending', accountId: input.accountId, categoryId: null, ruleId: null },
      accountId: input.accountId, postTime, hash: held.hash, source: held.origin,
    });
    const ins = await supabase.from('transactions').insert(row);
    // A row with this hash already exists: it was added from the other device. Just clear the held one.
    if (ins.error && ins.error.code !== '23505') return { error: 'Could not add that. Try again.' };
    await supabase.from('held_captures').delete().eq('hash', held.hash);
    if (!ins.error) await pairRecent(supabase, postTime + 15 * 60_000);
    return { ok: true };
  }
  const del = await supabase.from('held_captures').delete().eq('hash', held.hash);
  return del.error ? { error: 'Could not drop that. Try again.' } : { ok: true };
}
