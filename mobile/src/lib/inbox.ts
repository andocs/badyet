import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureCardPaymentCategory, ensureTransferCategory, isMoveCategory } from '@/lib/capture/transfer-category';
import { bestGuess, matchRule, normalizePattern, type MerchantRule } from '@/lib/inbox/rules';
import { transferHoldUntil, type HoldAccount } from '@/lib/capture/hold';

export interface Category { id: string; name: string }

export interface InboxTxn {
  id: string;
  who: string;
  /** Centavos; negative = money out. */
  amount: number;
  account: string;
  accountId: string;
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
  /** ISO time until which this looks like one side of a transfer still waiting for its other side; null = no wait. */
  holdUntil: string | null;
}

export interface InboxData {
  txns: InboxTxn[];
  categories: Category[];
  /** Budget lines that go to an account: a payment can be linked to one so it shows as sent. */
  bills: { id: string; name: string }[];
  /** Your live accounts, for changing which one an item is on. */
  accounts: { id: string; name: string }[];
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
  accounts: { id: string; name: string; institution?: string | null; archived_at?: string | null }[],
  rules: RuleRow[],
  history: { merchant: string | null; category_id: string | null }[],
  nowMs: number = Date.now(),
): InboxTxn[] {
  const live: HoldAccount[] = accounts.filter((a) => !a.archived_at).map((a) => ({ id: a.id, name: a.name, institution: a.institution ?? null }));
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
        accountId: r.account_id,
        peerAccount: peer ? (accountName.get(peer.account_id) ?? null) : null,
        occurredAt: r.occurred_at,
        source: SOURCE[r.source] ?? r.source,
        kind: r.kind,
        status: r.status,
        categoryId,
        categoryName: categoryId ? (catName.get(categoryId) ?? null) : null,
        guess,
        note: r.note,
        holdUntil: (() => {
          const until = transferHoldUntil({ status: r.status, kind: r.kind, source: r.source, occurredAt: r.occurred_at, counterparty: r.merchant, accountId: r.account_id }, live, nowMs);
          return until === null ? null : new Date(until).toISOString();
        })(),
      };
    });
}

const COLS = 'id, account_id, occurred_at, amount, merchant, kind, category_id, transfer_peer_id, source, status, note';

export async function loadInbox(supabase: SupabaseClient): Promise<InboxData> {
  // The Transfer category exists from the first visit, so a move between your own accounts can be filed under it.
  await ensureTransferCategory(supabase).catch(() => null);
  await ensureCardPaymentCategory(supabase).catch(() => null);
  const [cats, acct, rulesRes, pendingRes, recentRes, historyRes, billsRes] = await Promise.all([
    supabase.from('categories').select('id, name').is('archived_at', null).neq('name', 'Transfer').order('sort'),
    supabase.from('accounts').select('id, name, institution, archived_at'),
    supabase.from('merchant_rules').select('id, pattern, category_id, account_id, priority'),
    supabase.from('transactions').select(COLS).eq('status', 'pending').order('occurred_at', { ascending: false }),
    supabase.from('transactions').select(COLS).neq('status', 'ignored').order('occurred_at', { ascending: false }).limit(60),
    supabase.from('transactions').select('merchant, category_id').eq('status', 'confirmed').not('category_id', 'is', null).order('occurred_at', { ascending: false }).limit(500),
    supabase.from('budget_lines_v2').select('id, name').not('account_id', 'is', null).neq('rule', 'rest').order('name'),
  ]);
  for (const r of [cats, acct, rulesRes, pendingRes, recentRes, historyRes]) if (r.error) throw r.error;
  const categories = (cats.data ?? []) as Category[];
  const rows = [...((recentRes.data ?? []) as Row[]), ...((pendingRes.data ?? []) as Row[])];
  return {
    categories,
    bills: billsRes.error ? [] : ((billsRes.data ?? []) as { id: string; name: string }[]),
    accounts: ((acct.data ?? []) as { id: string; name: string; archived_at: string | null }[]).filter((a) => !a.archived_at).map((a) => ({ id: a.id, name: a.name })),
    txns: buildInbox(rows, categories, (acct.data ?? []) as { id: string; name: string; institution: string | null; archived_at: string | null }[], (rulesRes.data ?? []) as RuleRow[], (historyRes.data ?? []) as { merchant: string | null; category_id: string | null }[]),
  };
}

export type Result = { ok: true } | { error: string };

/**
 * Confirms a pending row. A normal row needs a category; a transfer does not, and confirming one also confirms its other leg.
 * With `rule`, "always put this merchant under this category" is saved. Only confirmed rows move balances.
 */
export async function confirmTransaction(
  supabase: SupabaseClient,
  input: { id: string; categoryId: string | null; rule: boolean; note: string; billId?: string | null; asTransfer?: boolean },
): Promise<Result> {
  if (!UUID.test(input.id)) return { error: 'That transaction was not found.' };
  const row = await supabase.from('transactions').select('id, kind, status, merchant, transfer_peer_id, account_id, occurred_at, source, amount').eq('id', input.id).maybeSingle();
  if (!row.data || row.data.status !== 'pending') return { error: 'That one is no longer waiting.' };

  // "Pays a bill": the payment marks that bill sent for the cutoff. Only money going out can pay one.
  let billId: string | null = null;
  if (input.billId) {
    if (!UUID.test(input.billId) || Number(row.data.amount) >= 0) return { error: 'That bill was not found.' };
    const line = await supabase.from('budget_lines_v2').select('id').eq('id', input.billId).not('account_id', 'is', null).maybeSingle();
    if (!line.data) return { error: 'That bill was not found.' };
    billId = input.billId;
  }

  const isTransfer = row.data.kind === 'transfer';
  let categoryId: string | null = null;
  // Picking the Transfer category says it was a move between your own accounts, so it stops counting as spending or income.
  let becomesTransfer = false;
  if (!isTransfer && input.asTransfer === true) {
    // The Transfer button: a move between your own accounts. It needs no category.
    becomesTransfer = true;
  } else if (!isTransfer) {
    if (!input.categoryId || !UUID.test(input.categoryId)) return { error: 'Pick a category first.' };
    const cat = await supabase.from('categories').select('id, name').eq('id', input.categoryId).is('archived_at', null).maybeSingle();
    if (!cat.data) return { error: 'That category was not found.' };
    categoryId = input.categoryId;
    becomesTransfer = isMoveCategory(cat.data.name as string);
    // A transfer-looking item waits a few minutes for its other side before it can count as spending or income.
    if (!becomesTransfer) {
      const accts = await supabase.from('accounts').select('id, name, institution').is('archived_at', null);
      const until = transferHoldUntil(
        { status: row.data.status, kind: row.data.kind, source: row.data.source, occurredAt: row.data.occurred_at, counterparty: row.data.merchant, accountId: row.data.account_id },
        (accts.data ?? []) as HoldAccount[],
        Date.now(),
      );
      if (until !== null) {
        const at = new Date(until).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
        return { error: `This may be a transfer between your accounts. Wait until ${at} for the other side, or confirm it as a transfer.` };
      }
    }
  }

  const note = input.note.trim().slice(0, 200) || null;
  const ids = [row.data.id as string, ...(isTransfer && row.data.transfer_peer_id ? [row.data.transfer_peer_id as string] : [])];
  const upd = await supabase
    .from('transactions')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), category_id: categoryId, note, ...(becomesTransfer ? { kind: 'transfer' } : {}) })
    .in('id', ids)
    .eq('status', 'pending');
  if (upd.error) return { error: 'Could not confirm that. Try again.' };
  if (billId) {
    const link = await supabase.from('transactions').update({ budget_line_id: billId }).eq('id', row.data.id);
    if (link.error) return { error: 'Confirmed, but it was not linked to the bill. Mark the bill sent on Now.' };
  }

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
