import type { Decision } from './decide';
import type { Parsed } from './parsers';
import { SOURCE_INFO, type SourceConfig } from './sources';

/** A transaction as the phone inserts it. Same columns the web writes. */
export interface TxnInsert {
  id: string;
  account_id: string;
  occurred_at: string;
  /** Centavos, negative = money out. */
  amount: number;
  merchant: string | null;
  kind: 'expense' | 'income';
  category_id: string | null;
  source: 'manual' | 'notification' | 'import';
  status: 'pending' | 'confirmed';
  confirmed_at: string | null;
  /** Spots a repeat of the same notification. Unique per user in the database. */
  dedupe_hash?: string | null;
}

export interface AccountLite {
  id: string;
  name: string;
  institution: string | null;
  last4: string | null;
}

/**
 * The text a hash is made from. A reference number identifies the event on its own; without one, the same amount,
 * direction and counterparty within the same minute counts as a repeat. Raw notification text is never part of it.
 */
export function dedupeKey(p: Parsed, postTime: number): string {
  if (p.ref) return `${p.source}|ref|${p.ref}`;
  return [p.source, p.direction, p.amount, Math.floor(postTime / 60_000), (p.counterparty ?? '').toLowerCase()].join('|');
}

const GENERIC = new Set(['account', 'accounts', 'savings', 'bank', 'card', 'wallet', 'debit', 'credit', 'cash', 'main', 'the', 'and']);

/** Words that identify an account: its name and bank, without filler like "savings". */
export function accountWords(a: Pick<AccountLite, 'name' | 'institution'>): string[] {
  return `${a.name} ${a.institution ?? ''}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !GENERIC.has(w));
}

/**
 * Which of your accounts a capture belongs to: the one you chose for the source, else the one whose last digits match,
 * else the only one named like the source. Returns null when it cannot tell, so nothing lands in the wrong account.
 */
export function resolveAccount(config: SourceConfig, p: Parsed, accounts: readonly AccountLite[]): string | null {
  if (config.accountId && accounts.some((a) => a.id === config.accountId)) return config.accountId;
  if (p.accountHint) {
    const byDigits = accounts.filter((a) => a.last4 && (a.last4.endsWith(p.accountHint!) || p.accountHint!.endsWith(a.last4)));
    if (byDigits.length === 1) return byDigits[0]!.id;
  }
  if (p.accountName) {
    const nick = accountWords({ name: p.accountName, institution: null });
    const byNick = accounts.filter((a) => nick.some((w) => accountWords(a).includes(w)));
    if (byNick.length === 1) return byNick[0]!.id;
  }
  const words = SOURCE_INFO[config.source].label.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  const byName = accounts.filter((a) => words.some((w) => accountWords(a).includes(w)));
  return byName.length === 1 ? byName[0]!.id : null;
}

/** The row to insert for a kept capture. */
export function buildRow(args: {
  id: string;
  parsed: Parsed;
  decision: Extract<Decision, { keep: true }>;
  accountId: string;
  postTime: number;
  hash: string;
  /** 'notification' for phone alerts, 'import' for emails. */
  source?: 'notification' | 'import';
}): TxnInsert {
  const { parsed: p, decision: d } = args;
  const at = new Date(args.postTime).toISOString();
  const confirmed = d.status === 'confirmed';
  return {
    id: args.id,
    account_id: args.accountId,
    occurred_at: at,
    amount: p.direction === 'out' ? -p.amount : p.amount,
    merchant: p.counterparty,
    kind: p.direction === 'out' ? 'expense' : 'income',
    category_id: d.categoryId,
    source: args.source ?? 'notification',
    status: d.status,
    confirmed_at: confirmed ? at : null,
    dedupe_hash: args.hash,
  };
}
