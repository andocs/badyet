import { accountWords } from './row';

/** How long a transfer-looking capture waits for its other side before it can be confirmed as spending or income. */
export const TRANSFER_HOLD_MS = 5 * 60_000;

/** Bank rails that only say how the money moved, not who it was with: "You have received P1,100 from InstaPay." */
const RAIL = /\b(instapay|pesonet)\b/i;

export interface HoldCandidate {
  status: string;
  kind: string;
  source: string;
  /** ISO timestamp. */
  occurredAt: string;
  /** The merchant / counterparty the message named. */
  counterparty: string | null;
  accountId: string | null;
}

export interface HoldAccount {
  id: string;
  name: string;
  institution: string | null;
}

/**
 * When a captured item looks like one side of a move between your own accounts (it names another of your accounts, or only says
 * InstaPay / PESONet), the time until which it should not be confirmed as spending or income, so the other side (often an email
 * a few minutes later) can arrive and pair with it. Null when it does not look like a transfer or the wait is over.
 */
export function transferHoldUntil(t: HoldCandidate, accounts: readonly HoldAccount[], nowMs: number): number | null {
  if (t.status !== 'pending' || t.kind === 'transfer') return null;
  if (t.source !== 'notification' && t.source !== 'import') return null;
  const until = Date.parse(t.occurredAt) + TRANSFER_HOLD_MS;
  if (!Number.isFinite(until) || until <= nowMs) return null;
  const who = (t.counterparty ?? '').toLowerCase();
  if (who === '') return null;
  if (RAIL.test(who)) return until;
  const namesOwn = accounts.some((a) => a.id !== t.accountId && accountWords(a).some((w) => who.includes(w)));
  return namesOwn ? until : null;
}
