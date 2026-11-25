import { accountWords, type AccountLite } from './row';

export interface PairCandidate {
  id: string;
  accountId: string;
  /** Centavos, negative = money out. */
  amount: number;
  /** Milliseconds. */
  at: number;
  counterparty: string | null;
  /** Last digits of the other side's account, when known (only while the notification is fresh). */
  counterpartyLast4?: string | null;
}

const normalize = (t: string | null) => (t ?? '').toLowerCase();

function mentions(text: string | null, account: AccountLite): boolean {
  const t = normalize(text);
  return accountWords(account).some((w) => t.includes(w));
}

/**
 * Finds moves between your own accounts that arrived as two separate notifications or emails: money out of one account and the same
 * amount into another, within an hour of each other (a bank email can trail the wallet alert by a long while), where at least one side
 * names the other account. Each is paired once, closest
 * in time first. The pair then counts as a transfer instead of spending plus income.
 */
/** How far apart the two sides of one transfer may be. An email from the bank can arrive long after the wallet notification. */
export const PAIR_WINDOW_MS = 60 * 60_000;

export function findTransferPairs(
  rows: readonly PairCandidate[],
  accounts: readonly AccountLite[],
  windowMs = PAIR_WINDOW_MS,
): { outId: string; inId: string }[] {
  const acct = new Map(accounts.map((a) => [a.id, a]));
  const outs = rows.filter((r) => r.amount < 0);
  const ins = rows.filter((r) => r.amount > 0);
  const options: { out: PairCandidate; inn: PairCandidate; gap: number }[] = [];
  for (const o of outs) {
    for (const i of ins) {
      const oa = acct.get(o.accountId);
      const ia = acct.get(i.accountId);
      if (!oa || !ia || o.accountId === i.accountId) continue;
      if (-o.amount !== i.amount) continue;
      const gap = Math.abs(o.at - i.at);
      if (gap > windowMs) continue;
      const linked = mentions(o.counterparty, ia) || mentions(i.counterparty, oa) || (!!o.counterpartyLast4 && o.counterpartyLast4 === ia.last4) || (!!i.counterpartyLast4 && i.counterpartyLast4 === oa.last4);
      if (linked) options.push({ out: o, inn: i, gap });
    }
  }
  options.sort((a, b) => a.gap - b.gap);
  const used = new Set<string>();
  const pairs: { outId: string; inId: string }[] = [];
  for (const { out, inn } of options) {
    if (used.has(out.id) || used.has(inn.id)) continue;
    used.add(out.id);
    used.add(inn.id);
    pairs.push({ outId: out.id, inId: inn.id });
  }
  return pairs;
}
