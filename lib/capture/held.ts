import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureTransferCategory } from './transfer-category';
import type { Parsed } from './parsers';
import { isSource } from './sources';
import { buildRow, type TxnInsert } from './row';
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

/**
 * A held capture, answered, as the confirmed row it becomes: the account and category are known (or it is a move to one of your own
 * accounts, which wears the Transfer category and needs none), so there is nothing left to check.
 */
export function confirmedRow(base: TxnInsert, how: { transfer: boolean; categoryId: string | null; transferCategoryId: string | null; at: string }): TxnInsert {
  return {
    ...base,
    kind: how.transfer ? 'transfer' : base.kind,
    category_id: how.transfer ? how.transferCategoryId : how.categoryId,
    status: 'confirmed',
    confirmed_at: how.at,
  };
}

export type Result = { ok: true; note?: string } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Answers a held capture. With an account it is confirmed there at once: as a transfer when the other side is also one of your accounts
 * (`otherName`), otherwise under the category you chose. With null it is dropped. Either way the held row goes. A capture already
 * added (same hash) is not added twice.
 */
export async function resolveHeldRow(
  supabase: SupabaseClient,
  input: { hash: string; accountId: string | null; otherName?: string | null; categoryId?: string | null },
): Promise<Result> {
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
    const transfer = !!input.otherName;
    let transferCategoryId: string | null = null;
    if (transfer) transferCategoryId = await ensureTransferCategory(supabase);
    else {
      if (!input.categoryId || !UUID.test(input.categoryId)) return { error: 'Pick a category first.' };
      const cat = await supabase.from('categories').select('id').eq('id', input.categoryId).is('archived_at', null).maybeSingle();
      if (!cat.data) return { error: 'That category was not found.' };
    }
    const postTime = Date.parse(held.post_time);
    const base = buildRow({
      id: crypto.randomUUID(),
      parsed: input.otherName ? { ...parsed, counterparty: input.otherName } : parsed,
      decision: { keep: true, status: 'pending', accountId: input.accountId, categoryId: null, ruleId: null },
      accountId: input.accountId, postTime, hash: held.hash, source: held.origin,
    });
    const row = confirmedRow(base, { transfer, categoryId: input.categoryId ?? null, transferCategoryId, at: new Date().toISOString() });
    const ins = await supabase.from('transactions').insert(row);
    // A row with this hash already exists: it was added from the other device. Just clear the held one.
    if (ins.error && ins.error.code !== '23505') return { error: 'Could not add that. Try again.' };
    await supabase.from('held_captures').delete().eq('hash', held.hash);
    if (!ins.error && !transfer) await pairRecent(supabase, postTime + 15 * 60_000);
    return { ok: true };
  }
  const del = await supabase.from('held_captures').delete().eq('hash', held.hash);
  return del.error ? { error: 'Could not drop that. Try again.' } : { ok: true };
}
