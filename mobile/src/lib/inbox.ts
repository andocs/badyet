import type { SupabaseClient } from '@supabase/supabase-js';
import { bestGuess, matchRule, normalizePattern, type MerchantRule } from '@/lib/inbox/rules';

export interface Category { id: string; name: string }

export interface InboxTxn {
  id: string;
  who: string;
  /** Centavos; negative = money out. */
  amount: number;
  account: string;
  /** For a transfer: the other account. */
  peerAccount: string | null;
  occurredAt: string;
  source: string;
  kind: 'expense' | 'income' | 'transfer';
  status: 'pending' | 'confirmed';
  categoryId: string | null;
  categoryName: string | null;
  /** Where a suggested category came from. */
  guess: 'rule' | 'history' | null;
  note: string | null;
}

export interface InboxData {
  txns: InboxTxn[];
  categories: Category[];
}

export interface Row {
  id: string;
  account_id: string;
  occurred_at: string;
  amount: number;
  merchant: string | null;
  kind: 'expense' | 'income' | 'transfer';
  category_id: string | null;
  transfer_peer_id: string | null;
  source: string;
  status: 'pending' | 'confirmed' | 'ignored';
  note: string | null;
}
export interface RuleRow { id: string; pattern: string; category_id: string; account_id: string | null; priority: number }

const SOURCE: Record<string, string> = {
  notification: 'Notification',
  manual: 'Added by you',
  transfer: 'Transfer',
  import: 'Import',
  bonus: 'Bonus',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Same suggestion order as the web Inbox: your rule first, then what you did with this merchant before. */
export function buildInbox(
  rows: Row[],
  categories: Category[],
  accounts: { id: string; name: string }[],
  rules: RuleRow[],
  history: { merchant: string | null; category_id: string | null }[],
): InboxTxn[] {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const mr: MerchantRule[] = rules.map((r) => ({ id: r.id, pattern: r.pattern, categoryId: r.category_id, accountId: r.account_id, priority: r.priority }));
  const hist = history.map((h) => ({ merchant: h.merchant, categoryId: h.category_id }));
  const all = new Map(rows.map((r) => [r.id, r]));

  return [...all.values()]
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .filter((r): r is Row & { status: 'pending' | 'confirmed' } => r.status !== 'ignored')
    .map((r) => {
      let categoryId = r.category_id;
      let guess: InboxTxn['guess'] = null;
      if (r.status === 'pending' && r.kind !== 'transfer' && categoryId === null) {
        const rule = matchRule(r.merchant, r.account_id, mr);
        if (rule) {
          categoryId = rule.categoryId;
          guess = 'rule';
        } else {
          const g = bestGuess(r.merchant, hist);
          if (g) {
            categoryId = g;
            guess = 'history';
          }
        }
      }
      const peer = r.transfer_peer_id ? all.get(r.transfer_peer_id) : undefined;
      return {
        id: r.id,
        who: r.merchant ?? (r.kind === 'transfer' ? (r.amount < 0 ? 'Transfer out' : 'Transfer in') : 'Expense'),
        amount: r.amount,
        account: accountName.get(r.account_id) ?? 'Account',
        peerAccount: peer ? (accountName.get(peer.account_id) ?? null) : null,
        occurredAt: r.occurred_at,
        source: SOURCE[r.source] ?? r.source,
        kind: r.kind,
        status: r.status,
        categoryId,
        categoryName: categoryId ? (catName.get(categoryId) ?? null) : null,
        guess,
        note: r.note,
      };
    });
}

const COLS = 'id, account_id, occurred_at, amount, merchant, kind, category_id, transfer_peer_id, source, status, note';

export async function loadInbox(supabase: SupabaseClient): Promise<InboxData> {
  const [cats, acct, rulesRes, pendingRes, recentRes, historyRes] = await Promise.all([
    supabase.from('categories').select('id, name').is('archived_at', null).order('sort'),
    supabase.from('accounts').select('id, name'),
    supabase.from('merchant_rules').select('id, pattern, category_id, account_id, priority'),
    supabase.from('transactions').select(COLS).eq('status', 'pending').order('occurred_at', { ascending: false }),
    supabase.from('transactions').select(COLS).neq('status', 'ignored').order('occurred_at', { ascending: false }).limit(60),
    supabase.from('transactions').select('merchant, category_id').eq('status', 'confirmed').not('category_id', 'is', null).order('occurred_at', { ascending: false }).limit(500),
  ]);
  for (const r of [cats, acct, rulesRes, pendingRes, recentRes, historyRes]) if (r.error) throw r.error;
  const categories = (cats.data ?? []) as Category[];
  const rows = [...((recentRes.data ?? []) as Row[]), ...((pendingRes.data ?? []) as Row[])];
  return {
    categories,
    txns: buildInbox(rows, categories, (acct.data ?? []) as { id: string; name: string }[], (rulesRes.data ?? []) as RuleRow[], (historyRes.data ?? []) as { merchant: string | null; category_id: string | null }[]),
  };
}

export type Result = { ok: true } | { error: string };

/**
 * Confirms a pending row. A normal row needs a category; a transfer does not, and confirming one also confirms its other leg.
 * With `rule`, "always put this merchant under this category" is saved. Only confirmed rows move balances.
 */
export async function confirmTransaction(
  supabase: SupabaseClient,
  input: { id: string; categoryId: string | null; rule: boolean; note: string },
): Promise<Result> {
  if (!UUID.test(input.id)) return { error: 'That transaction was not found.' };
  const row = await supabase.from('transactions').select('id, kind, status, merchant, transfer_peer_id').eq('id', input.id).maybeSingle();
  if (!row.data || row.data.status !== 'pending') return { error: 'That one is no longer waiting.' };

  const isTransfer = row.data.kind === 'transfer';
  let categoryId: string | null = null;
  if (!isTransfer) {
    if (!input.categoryId || !UUID.test(input.categoryId)) return { error: 'Pick a category first.' };
    const cat = await supabase.from('categories').select('id').eq('id', input.categoryId).is('archived_at', null).maybeSingle();
    if (!cat.data) return { error: 'That category was not found.' };
    categoryId = input.categoryId;
  }

  const note = input.note.trim().slice(0, 200) || null;
  const ids = [row.data.id as string, ...(isTransfer && row.data.transfer_peer_id ? [row.data.transfer_peer_id as string] : [])];
  const upd = await supabase
    .from('transactions')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), category_id: categoryId, note })
    .in('id', ids)
    .eq('status', 'pending');
  if (upd.error) return { error: 'Could not confirm that. Try again.' };

  const pattern = normalizePattern(row.data.merchant as string | null);
  if (input.rule && categoryId && pattern) {
    const exists = await supabase
      .from('merchant_rules')
      .select('id')
      .ilike('pattern', pattern.replace(/[%_\\]/g, '\\$&'))
      .eq('category_id', categoryId)
      .maybeSingle();
    if (!exists.data) await supabase.from('merchant_rules').insert({ pattern, category_id: categoryId, priority: 0 });
  }
  return { ok: true };
}

/** "Not mine": the row is ignored. It never counts and no longer shows. */
export async function ignoreTransaction(supabase: SupabaseClient, id: string): Promise<Result> {
  if (!UUID.test(id)) return { error: 'That transaction was not found.' };
  const row = await supabase.from('transactions').select('id, kind, status, transfer_peer_id').eq('id', id).maybeSingle();
  if (!row.data || row.data.status !== 'pending') return { error: 'That one is no longer waiting.' };
  const ids = [row.data.id as string, ...(row.data.kind === 'transfer' && row.data.transfer_peer_id ? [row.data.transfer_peer_id as string] : [])];
  const upd = await supabase.from('transactions').update({ status: 'ignored' }).in('id', ids).eq('status', 'pending');
  if (upd.error) return { error: 'Could not update that. Try again.' };
  return { ok: true };
}
