import type { SupabaseClient } from '@supabase/supabase-js';
import { counterLeg } from './held';
import { PAIR_WINDOW_MS } from './pair';
import type { TxnInsert } from './row';
import { ensureTransferCategory } from './transfer-category';

/**
 * "Other account" on the Inbox's Transfer button: when only one side of a move sent a message, this completes it. If that account
 * already has an unmatched entry for the same money, the two are joined; otherwise the missing side is made. Called after the first
 * side has been confirmed as a transfer. The web and the phone share this.
 */
export type Result = { ok: true } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAILED = 'Confirmed on one side, but the other account was not updated. Open it in the Inbox and try again.';

/** Checks the pick before anything is confirmed, so a wrong one changes nothing. */
export async function checkOtherAccount(supabase: SupabaseClient, accountId: string, otherId: string): Promise<Result> {
  if (!UUID.test(otherId) || otherId === accountId) return { error: 'Pick a different account for the other side.' };
  const a = await supabase.from('accounts').select('id').eq('id', otherId).is('archived_at', null).maybeSingle();
  return a.data ? { ok: true } : { error: 'That account was not found.' };
}

export async function addOtherSide(supabase: SupabaseClient, input: { id: string; otherAccountId: string; newId: string }): Promise<Result> {
  const row = await supabase.from('transactions').select('id, account_id, occurred_at, amount, source, status, confirmed_at, transfer_peer_id').eq('id', input.id).maybeSingle();
  const first = row.data as (Pick<TxnInsert, 'id' | 'account_id' | 'occurred_at' | 'amount' | 'source' | 'status' | 'confirmed_at'> & { transfer_peer_id: string | null }) | null;
  if (!first) return { error: FAILED };
  if (first.transfer_peer_id) return { ok: true }; // both sides are already there
  const category = await ensureTransferCategory(supabase).catch(() => null);
  const at = Date.parse(first.occurred_at);
  // The other account's own message may already be waiting, unmatched.
  const found = await supabase
    .from('transactions')
    .select('id')
    .eq('account_id', input.otherAccountId)
    .eq('amount', -first.amount)
    .is('transfer_peer_id', null)
    .neq('status', 'ignored')
    .gte('occurred_at', new Date(at - PAIR_WINDOW_MS).toISOString())
    .lte('occurred_at', new Date(at + PAIR_WINDOW_MS).toISOString())
    .limit(1);
  const existing = ((found.data ?? []) as { id: string }[])[0];
  if (existing) {
    const joined = await supabase
      .from('transactions')
      .update({ kind: 'transfer', category_id: category, transfer_peer_id: first.id, status: first.status, confirmed_at: first.confirmed_at })
      .eq('id', existing.id);
    if (joined.error) return { error: FAILED };
    const back = await supabase.from('transactions').update({ transfer_peer_id: existing.id, category_id: category }).eq('id', first.id);
    return back.error ? { error: FAILED } : { ok: true };
  }
  const leg = counterLeg({ ...first, kind: 'transfer', category_id: category, merchant: null, dedupe_hash: null } as TxnInsert, input.otherAccountId, input.newId);
  const made = await supabase.from('transactions').insert(leg);
  if (made.error) return { error: FAILED };
  if (category) await supabase.from('transactions').update({ category_id: category }).eq('id', first.id);
  return { ok: true };
}
