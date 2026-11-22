import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureTransferCategory } from '@/lib/capture/transfer-category';
import { findTransferPairs, type PairCandidate } from '@/lib/capture/pair';
import type { AccountLite } from '@/lib/capture/row';

const WINDOW_MS = 30 * 60_000;

/**
 * Looks at what was captured in the last half hour and links moves between your own accounts (money out of one, the same
 * amount into another) as a transfer, so they do not count as spending plus income. Returns how many pairs it linked.
 */
export async function pairRecent(supabase: SupabaseClient, now: number = Date.now()): Promise<number> {
  const since = new Date(now - WINDOW_MS).toISOString();
  const [acc, tx] = await Promise.all([
    supabase.from('accounts').select('id, name, institution, last4').is('archived_at', null),
    supabase.from('transactions').select('id, account_id, amount, occurred_at, merchant').eq('source', 'notification').in('kind', ['expense', 'income']).neq('status', 'ignored').gte('occurred_at', since),
  ]);
  if (acc.error || tx.error) return 0;
  const rows = (tx.data ?? []) as { id: string; account_id: string; amount: number; occurred_at: string; merchant: string | null }[];
  const candidates: PairCandidate[] = rows.map((r) => ({ id: r.id, accountId: r.account_id, amount: r.amount, at: Date.parse(r.occurred_at), counterparty: r.merchant }));
  const pairs = findTransferPairs(candidates, (acc.data ?? []) as AccountLite[]);

  if (pairs.length === 0) return 0;
  // Paired moves wear the Transfer category (made the first time), so they read as transfers everywhere and never as spending.
  const transferCategory = await ensureTransferCategory(supabase);
  let linked = 0;
  for (const { outId, inId } of pairs) {
    const a = await supabase.from('transactions').update({ kind: 'transfer', transfer_peer_id: inId, category_id: transferCategory }).eq('id', outId);
    const b = await supabase.from('transactions').update({ kind: 'transfer', transfer_peer_id: outId, category_id: transferCategory }).eq('id', inId);
    if (!a.error && !b.error) linked += 1;
  }
  return linked;
}
