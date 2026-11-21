import type { SupabaseClient } from '@supabase/supabase-js';
import { money, sum, type Money } from '@/lib/domain/money';
import { balanceNow } from '@/lib/engine/balances';

export interface AccountRow {
  id: string;
  name: string;
  kind: string;
  institution: string | null;
  last4: string | null;
  color: string | null;
}
export interface AnchorRow { account_id: string; as_of: string; amount: number }
export interface TxnRow {
  account_id: string;
  occurred_at: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'ignored';
}
export interface FundLink { name: string; linked_account_id: string }

export interface AccountCard extends AccountRow {
  balance: Money;
  /** Date of the latest balance anchor, or null if the balance was never confirmed. */
  confirmedOn: string | null;
  /** Name of the fund this account is set aside for, if any. */
  fund: string | null;
}

export interface AccountsData {
  spending: AccountCard[];
  funds: AccountCard[];
  /** Accounts you own; credit cards (money you owe) are left out. */
  total: Money;
  pending: number;
}

/** Same rule as the web Accounts page: latest anchor plus confirmed transactions after it. */
export function buildAccounts(accounts: AccountRow[], anchors: AnchorRow[], txns: TxnRow[], links: FundLink[]): AccountsData {
  const fundOf = new Map(links.map((f) => [f.linked_account_id, f.name]));
  const cards: AccountCard[] = accounts.map((a) => {
    const mine = anchors.filter((x) => x.account_id === a.id);
    const latest = [...mine].sort((x, y) => y.as_of.localeCompare(x.as_of))[0];
    const balance = balanceNow(
      mine.map((x) => ({ asOf: x.as_of, amount: money(x.amount) })),
      txns.filter((t) => t.account_id === a.id).map((t) => ({ occurredAt: t.occurred_at, amount: money(t.amount), status: t.status })),
    );
    return { ...a, balance, confirmedOn: latest?.as_of ?? null, fund: fundOf.get(a.id) ?? null };
  });
  const owned = cards.filter((c) => c.kind !== 'credit').map((c) => c.balance);
  return {
    spending: cards.filter((c) => !c.fund),
    funds: cards.filter((c) => c.fund),
    total: sum(owned),
    pending: txns.filter((t) => t.status === 'pending').length,
  };
}

export async function loadAccounts(supabase: SupabaseClient): Promise<AccountsData> {
  const [acctRes, anchorRes, fundRes] = await Promise.all([
    supabase.from('accounts').select('id, name, kind, institution, last4, color').is('archived_at', null).order('sort').order('created_at'),
    supabase.from('balance_anchors').select('account_id, as_of, amount'),
    supabase.from('funds').select('name, linked_account_id').is('archived_at', null).not('linked_account_id', 'is', null),
  ]);
  if (acctRes.error) throw acctRes.error;
  if (anchorRes.error) throw anchorRes.error;
  const anchors = (anchorRes.data ?? []) as AnchorRow[];
  const earliest = anchors.map((x) => x.as_of).sort()[0];
  const txRes = earliest
    ? await supabase.from('transactions').select('account_id, occurred_at, amount, status').neq('status', 'ignored').gte('occurred_at', earliest)
    : { data: [], error: null };
  if (txRes.error) throw txRes.error;
  return buildAccounts((acctRes.data ?? []) as AccountRow[], anchors, (txRes.data ?? []) as TxnRow[], (fundRes.data ?? []) as FundLink[]);
}
