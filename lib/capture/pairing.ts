import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureTransferCategory } from './transfer-category';
import { findTransferPairs, type PairCandidate } from './pair';
import type { AccountLite } from './row';
import type { Money } from '@/lib/domain/money';
import { duplicatedBy, type RecordedTransfer } from '@/lib/bills/reconcile';

/** Written on the legs of a transfer you ticked in the pay checklist once a bank notification for it has been matched to it. */
export const MATCHED_NOTE = 'Matched to a bank notification';

/** Transfers the app recorded itself (a tick or "Send the rest" on the pay checklist) in the last two days, not yet matched. */
async function recordedTransfers(supabase: SupabaseClient, now: number): Promise<RecordedTransfer[]> {
  const since = new Date(now - 2 * 24 * 60 * 60_000).toISOString();
  const r = await supabase.from('transactions').select('id, account_id, amount, occurred_at, transfer_peer_id, note').eq('source', 'transfer').eq('kind', 'transfer').neq('status', 'ignored').gte('occurred_at', since);
  if (r.error) return [];
  const rows = (r.data ?? []) as { id: string; account_id: string; amount: number; occurred_at: string; transfer_peer_id: string | null; note: string | null }[];
  const byId = new Map(rows.map((x) => [x.id, x]));
  const out: RecordedTransfer[] = [];
  for (const o of rows) {
    const peer = o.transfer_peer_id ? byId.get(o.transfer_peer_id) : undefined;
    if (o.amount >= 0 || !peer || o.note === MATCHED_NOTE) continue;
    out.push({ outId: o.id, inId: peer.id, fromId: o.account_id, toId: peer.account_id, amount: -o.amount as Money, at: Date.parse(o.occurred_at) });
  }
  return out;
}

/** How far back to look for the other side: an email can land hours after the alert, and the two sides may be up to an hour apart. */
const WINDOW_MS = 3 * 60 * 60_000;

/**
 * Looks at what was captured (phone notifications and emails) in the three hours before `now` and links moves between your own accounts (money out of one, the same
 * amount into another) as a transfer, so they do not count as spending plus income. Paired moves wear the Transfer category.
 * Returns how many pairs it linked. Runs on the phone after capture and on the web after a held capture is answered.
 */
export async function pairRecent(supabase: SupabaseClient, now: number = Date.now()): Promise<number> {
  const since = new Date(now - WINDOW_MS).toISOString();
  const [acc, tx] = await Promise.all([
    supabase.from('accounts').select('id, name, institution, last4').is('archived_at', null),
    supabase.from('transactions').select('id, account_id, amount, occurred_at, merchant').in('source', ['notification', 'import']).in('kind', ['expense', 'income']).neq('status', 'ignored').gte('occurred_at', since),
  ]);
  if (acc.error || tx.error) return 0;
  const rows = (tx.data ?? []) as { id: string; account_id: string; amount: number; occurred_at: string; merchant: string | null }[];
  const candidates: PairCandidate[] = rows.map((r) => ({ id: r.id, accountId: r.account_id, amount: r.amount, at: Date.parse(r.occurred_at), counterparty: r.merchant }));
  const pairs = findTransferPairs(candidates, (acc.data ?? []) as AccountLite[]);

  if (pairs.length === 0) return 0;

  // A move you already ticked in the pay checklist was recorded by the app, so the bank's notification for it is the same money: it is
  // set aside instead of being counted a second time.
  const recorded = await recordedTransfers(supabase, now);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const absorbed = new Set<string>();
  const fresh: typeof pairs = [];
  for (const pair of pairs) {
    const o = byId.get(pair.outId)!;
    const i = byId.get(pair.inId)!;
    const dup = duplicatedBy({ fromId: o.accountId, toId: i.accountId, amount: i.amount as Money, at: Math.min(o.at, i.at) }, recorded.filter((r) => !absorbed.has(r.outId)));
    if (!dup) {
      fresh.push(pair);
      continue;
    }
    for (const r of dup) absorbed.add(r.outId);
    await supabase.from('transactions').update({ status: 'ignored', note: 'Same as a transfer you ticked on the pay checklist' }).in('id', [pair.outId, pair.inId]);
    await supabase.from('transactions').update({ note: MATCHED_NOTE }).in('id', dup.flatMap((r) => [r.outId, r.inId]));
  }
  if (fresh.length === 0) return 0;
  // Paired moves wear the Transfer category (made the first time), so they read as transfers everywhere and never as spending.
  const transferCategory = await ensureTransferCategory(supabase);
  let linked = 0;
  for (const { outId, inId } of fresh) {
    const a = await supabase.from('transactions').update({ kind: 'transfer', transfer_peer_id: inId, category_id: transferCategory }).eq('id', outId);
    const b = await supabase.from('transactions').update({ kind: 'transfer', transfer_peer_id: outId, category_id: transferCategory }).eq('id', inId);
    if (!a.error && !b.error) linked += 1;
  }
  return linked;
}
