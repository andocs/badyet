import type { SupabaseClient } from '@supabase/supabase-js';
import { ACCOUNT_COLORS, anchorAmount, parseNewAccount, type AccountKind } from '@/lib/accounts/v13';
import { parsePesos } from '@/lib/domain/money';

export type Result = { ok: true } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 100_000_000_000;

/** Adds an account and its first balance anchor (the opening amount). Same rules as the web action. Never a full card number. */
export async function addAccount(supabase: SupabaseClient, input: Record<string, string>): Promise<Result> {
  const parsed = parseNewAccount(input);
  if (!parsed.ok) return { error: parsed.error };
  const a = parsed.value;
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      name: a.name,
      kind: a.kind,
      institution: a.institution,
      last4: a.last4,
      color: a.color,
      credit_limit: a.creditLimit,
      statement_day: a.statementDay,
      due_day: a.dueDay,
    })
    .select('id')
    .single();
  if (error || !data) return { error: error?.code === '23505' ? 'You already have an account with that name.' : 'Could not save the account. Try again.' };
  const anchor = await supabase.from('balance_anchors').insert({ account_id: data.id, as_of: new Date().toISOString(), amount: anchorAmount(a.kind, a.opening), source: 'wizard' });
  if (anchor.error) return { error: 'The account was added but its starting balance was not saved. Use Reconcile to set it.' };
  return { ok: true };
}

/** Sets the account's real balance now. It becomes the latest anchor; confirmed transactions after it move it from there. */
export async function reconcileAccount(supabase: SupabaseClient, input: { accountId: string; balance: string }): Promise<Result> {
  if (!UUID.test(input.accountId)) return { error: 'Pick an account.' };
  const entered = parsePesos(input.balance);
  if (entered === undefined || entered < 0 || entered > MAX) return { error: 'Enter the balance like 1,250.50.' };
  const acct = await supabase.from('accounts').select('id, kind').eq('id', input.accountId).is('archived_at', null).maybeSingle();
  if (!acct.data) return { error: 'That account was not found.' };
  const { error } = await supabase.from('balance_anchors').insert({
    account_id: input.accountId,
    as_of: new Date().toISOString(),
    amount: anchorAmount(acct.data.kind as AccountKind, entered),
    source: 'reconcile',
  });
  return error ? { error: 'Could not save the balance. Try again.' } : { ok: true };
}

/** Moves money between two of your accounts: two confirmed transfer rows that point at each other. */
export async function moveMoney(supabase: SupabaseClient, input: { from: string; to: string; amount: string }): Promise<Result> {
  if (!UUID.test(input.from) || !UUID.test(input.to)) return { error: 'Pick both accounts.' };
  if (input.from === input.to) return { error: 'Pick two different accounts.' };
  const amount = parsePesos(input.amount);
  if (amount === undefined || amount <= 0 || amount > MAX) return { error: 'Enter an amount above zero.' };

  const owned = await supabase.from('accounts').select('id').in('id', [input.from, input.to]).is('archived_at', null);
  if ((owned.data ?? []).length !== 2) return { error: 'One of those accounts was not found.' };

  const now = new Date().toISOString();
  const base = { occurred_at: now, kind: 'transfer', source: 'transfer', status: 'confirmed', confirmed_at: now };
  const { data, error } = await supabase
    .from('transactions')
    .insert([
      { ...base, account_id: input.from, amount: -amount },
      { ...base, account_id: input.to, amount },
    ])
    .select('id, account_id');
  if (error || !data || data.length !== 2) return { error: 'Could not move the money. Try again.' };
  const out = data.find((r: { account_id: string }) => r.account_id === input.from) as { id: string } | undefined;
  const inn = data.find((r: { account_id: string }) => r.account_id === input.to) as { id: string } | undefined;
  if (!out || !inn) return { error: 'Could not move the money. Try again.' };
  const a = await supabase.from('transactions').update({ transfer_peer_id: inn.id }).eq('id', out.id);
  const b = await supabase.from('transactions').update({ transfer_peer_id: out.id }).eq('id', inn.id);
  if (a.error || b.error) return { error: 'The money moved but the two sides were not linked. Check Inbox.' };
  return { ok: true };
}

/** Renames an account or changes its last four digits and colour. (New on the phone; the web has no edit yet.) */
export async function editAccount(
  supabase: SupabaseClient,
  input: { id: string; kind: AccountKind; name: string; last4: string; color: string },
): Promise<Result> {
  if (!UUID.test(input.id)) return { error: 'That account was not found.' };
  const parsed = parseNewAccount({ name: input.name, kind: input.kind, last4: input.last4, color: input.color });
  if (!parsed.ok) return { error: parsed.error };
  const color = (ACCOUNT_COLORS as readonly string[]).includes(input.color) ? input.color : parsed.value.color;
  const { error } = await supabase.from('accounts').update({ name: parsed.value.name, last4: parsed.value.last4, color }).eq('id', input.id).is('archived_at', null);
  if (error) return { error: error.code === '23505' ? 'You already have an account with that name.' : 'Could not save the account. Try again.' };
  return { ok: true };
}
