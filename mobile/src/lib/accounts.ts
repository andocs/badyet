import type { SupabaseClient } from '@supabase/supabase-js';
import { stableColor } from '@/lib/accounts/order';
import { money, sum, type Money } from '@/lib/domain/money';
import { balanceNow } from '@/lib/engine/balances';

export interface AccountRow {
  id: string;
  name: string;
  kind: string;
  institution: string | null;
  last4: string | null;
  color: string | null;
  credit_limit: number | null;
}
export interface AnchorRow { account_id: string; as_of: string; amount: number }
export interface TxnRow {
  id: string;
  account_id: string;
  occurred_at: string;
  amount: number;
  merchant: string | null;
  kind: 'expense' | 'income' | 'transfer';
  status: 'pending' | 'confirmed' | 'ignored';
}
export interface FundLink { name: string; linked_account_id: string }

export interface AccountCard extends AccountRow {
  /** Always set: the account's own colour, or one picked by position like the web does. */
  color: string;
  balance: Money;
  /** The latest balance anchor, or null if the balance was never confirmed. */
  latest: { asOf: string; amount: Money } | null;
  /** Confirmed transactions after the latest anchor: the lines of "the sum that proves it". */
  after: TxnRow[];
  /** Pending rows, which do not count yet. */
  pending: TxnRow[];
  pendingTotal: Money;
  /** Name of the fund this account is set aside for, if any. */
  fund: string | null;
}

export interface AccountsData {
  spending: AccountCard[];
  funds: AccountCard[];
  /** Accounts you own; credit cards (money you owe) are left out. */
  total: Money;
  pendingCount: number;
}

// Same fallback palette as the web Accounts page.
const COLORS = ['#2F5BD7', '#087A5A', '#B03030', '#7A3FB8', '#0F7A95', '#B83A86'];

/** Same rule as the web Accounts page: latest anchor plus confirmed transactions after it. */
export function buildAccounts(accounts: AccountRow[], anchors: AnchorRow[], txns: TxnRow[], links: FundLink[]): AccountsData {
  const fundOf = new Map(links.map((f) => [f.linked_account_id, f.name]));
  const cards: AccountCard[] = accounts.map((a, i) => {
    const mine = anchors.filter((x) => x.account_id === a.id);
    const latestRow = [...mine].sort((x, y) => y.as_of.localeCompare(x.as_of))[0];
    const own = txns.filter((t) => t.account_id === a.id);
    const balance = balanceNow(
      mine.map((x) => ({ asOf: x.as_of, amount: money(x.amount) })),
      own.map((t) => ({ occurredAt: t.occurred_at, amount: money(t.amount), status: t.status })),
    );
    const after = latestRow
      ? own.filter((t) => t.status === 'confirmed' && Date.parse(t.occurred_at) > Date.parse(latestRow.as_of))
      : [];
    const pending = own.filter((t) => t.status === 'pending');
    return {
      ...a,
      color: a.color ?? stableColor(a.id, COLORS),
      balance,
      latest: latestRow ? { asOf: latestRow.as_of, amount: money(latestRow.amount) } : null,
      after,
      pending,
      pendingTotal: sum(pending.map((t) => money(t.amount))),
      fund: fundOf.get(a.id) ?? null,
    };
  });
  const owned = cards.filter((c) => c.kind !== 'credit').map((c) => c.balance);
  return {
    spending: cards.filter((c) => !c.fund),
    funds: cards.filter((c) => c.fund),
    total: sum(owned),
    pendingCount: txns.filter((t) => t.status === 'pending').length,
  };
}

export async function loadAccounts(supabase: SupabaseClient): Promise<AccountsData> {
  const [acctRes, anchorRes, fundRes] = await Promise.all([
    supabase.from('accounts').select('id, name, kind, institution, last4, color, credit_limit').is('archived_at', null).order('sort').order('created_at'),
    supabase.from('balance_anchors').select('account_id, as_of, amount'),
    supabase.from('funds').select('name, linked_account_id').is('archived_at', null).not('linked_account_id', 'is', null),
  ]);
  if (acctRes.error) throw acctRes.error;
  if (anchorRes.error) throw anchorRes.error;
  const anchors = (anchorRes.data ?? []) as AnchorRow[];
  const earliest = anchors.map((x) => x.as_of).sort()[0];
  const txRes = earliest
    ? await supabase
        .from('transactions')
        .select('id, account_id, occurred_at, amount, merchant, kind, status')
        .neq('status', 'ignored')
        .gte('occurred_at', earliest)
        .order('occurred_at')
    : { data: [], error: null };
  if (txRes.error) throw txRes.error;
  return buildAccounts((acctRes.data ?? []) as AccountRow[], anchors, (txRes.data ?? []) as TxnRow[], (fundRes.data ?? []) as FundLink[]);
}
