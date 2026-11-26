import { PAIR_WINDOW_MS } from './pair';
import { accountWords, type AccountLite } from './row';

/**
 * When one message records a move between your own accounts, the app makes the other account's entry itself. If that account then
 * sends its own message about the same money, it must not be added a second time. That entry is "claimed" by the message instead:
 * it gets the message's duplicate key, so it is claimed once.
 */
export interface MadeLeg {
  id: string;
  accountId: string;
  /** Centavos, negative = money out. */
  amount: number;
  /** Milliseconds. */
  at: number;
  /** The account on the other side of that move. */
  peerAccountId: string;
}

export interface LaterCapture {
  accountId: string;
  amount: number;
  at: number;
  /** Who the new message says it was with, when it says. */
  counterparty: string | null;
}

/**
 * The entry this new message is about, or null when it is a separate movement. Same account, same money, within an hour, and the
 * message either names nobody or names the other account of that move: a purchase of the same amount that names a shop is kept.
 */
export function madeLegFor(c: LaterCapture, legs: readonly MadeLeg[], accounts: readonly AccountLite[]): MadeLeg | null {
  const who = (c.counterparty ?? '').toLowerCase();
  const fits = legs.filter((l) => {
    if (l.accountId !== c.accountId || l.amount !== c.amount || Math.abs(l.at - c.at) > PAIR_WINDOW_MS) return false;
    if (who === '') return true;
    const peer = accounts.find((a) => a.id === l.peerAccountId);
    return !!peer && accountWords(peer).some((w) => who.includes(w));
  });
  return fits.sort((a, b) => Math.abs(a.at - c.at) - Math.abs(b.at - c.at))[0] ?? null;
}
