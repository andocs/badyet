import { parsePesos } from '@/lib/domain/money';
import { compileTemplate } from './template';
import type { CapturePattern } from './patterns';
import type { SourceKey } from './sources';

/** What a notification means, with no raw text left in it. */
export interface Parsed {
  source: SourceKey;
  direction: 'in' | 'out';
  /** Centavos, always positive. */
  amount: number;
  /** Who it came from or went to, as the app words it (phone numbers removed). */
  counterparty: string | null;
  /** Last digits of the other side's account, when the notification shows them. */
  counterpartyLast4: string | null;
  /** Last digits of YOUR account, when the notification shows them. */
  accountHint: string | null;
  /** The app's reference number, when it has one. Best key for spotting a repeat. */
  ref: string | null;
  /** Your own account's nickname, when the message shows it (BPI emails do). */
  accountName: string | null;
}

/** The pieces of an Android notification the parsers read. */
export interface RawNotification {
  title: string | null;
  text: string | null;
  bigText: string | null;
}

const CUR = String.raw`(?:PHP|P|₱)?\s?`;
const AMT = String.raw`([\d,]+(?:\.\d{1,2})?)`;

/** "1,250.50" -> 125050, or null. */
export function centavos(text: string | undefined): number | null {
  if (!text) return null;
  const m = parsePesos(text.replace(/,/g, '').replace(/\.$/, ''));
  return m === undefined || m <= 0 ? null : m;
}

/** Drops phone numbers and masked digits, collapses spaces, trims, and keeps it within the 80 characters a merchant allows. */
export function clean(counterparty: string | undefined): string | null {
  if (!counterparty) return null;
  let t = counterparty
    .replace(/\+?\d[\d\s-]{8,}\d/g, '')
    .replace(/[•*]{2,}\d{2,4}/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s,;:]+$/, '')
    .trim();
  // A closing full stop is sentence punctuation, except after an initial such as "D.".
  if (t.endsWith('.') && (t.split(' ').pop() ?? '').replace(/\./g, '').length > 2) t = t.slice(0, -1);
  return t ? t.slice(0, 80) : null;
}

const ref = (t: string): string | null => /Ref\.?\s*No\.?\s*:?\s*([A-Za-z0-9]+)/i.exec(t)?.[1] ?? null;

type Parser = (title: string, body: string) => Parsed | null;
const make = (p: Omit<Parsed, 'counterpartyLast4' | 'accountHint' | 'ref' | 'accountName'> & Partial<Parsed>): Parsed => ({ counterpartyLast4: null, accountHint: null, ref: null, accountName: null, ...p });

/**
 * GCash. Money in: "You have received 900.00 of GCash from BPI / VYBE by BPI with account ending in 8167."
 * Money out: "You have paid P112.00 of GCash to purchase X with a convenience fee of P3.00 ..." and "You have sent PHP 500.00 to NAME ..."
 * The convenience fee is part of what left the wallet, so it is added to a payment.
 */
const gcash: Parser = (_title, body) => {
  const rcv = new RegExp(String.raw`received\s+${CUR}${AMT}\s+of GCash from\s+(.+?)(?:\s+with account ending(?: in)?\s+(\d{2,4}))?(?:\.\s|\.\.|\.$|$)`, 'i').exec(body);
  if (rcv) {
    const amount = centavos(rcv[1]);
    return amount === null ? null : make({ source: 'gcash', direction: 'in', amount, counterparty: clean(rcv[2]), counterpartyLast4: rcv[3] ?? null, ref: ref(body) });
  }
  const paid = new RegExp(String.raw`paid\s+${CUR}${AMT}\s+of GCash to(?:\s+purchase)?\s+(.+?)(?:\s+with a convenience fee|\s+for\s+\d|\s+on\s+\d|\.\s|\.$|$)`, 'i').exec(body);
  if (paid) {
    const base = centavos(paid[1]);
    if (base === null) return null;
    const fee = centavos(new RegExp(String.raw`convenience fee of\s+${CUR}${AMT}`, 'i').exec(body)?.[1]) ?? 0;
    return make({ source: 'gcash', direction: 'out', amount: base + fee, counterparty: clean(paid[2]), ref: ref(body) });
  }
  const sent = new RegExp(String.raw`sent\s+${CUR}${AMT}\s+to\s+(.+?)\s+on\s+\d`, 'i').exec(body);
  if (sent) {
    const amount = centavos(sent[1]);
    return amount === null ? null : make({ source: 'gcash', direction: 'out', amount, counterparty: clean(sent[2]), ref: ref(body) });
  }
  return null;
};

/** Maya. "Success! You transferred ₱50.00 to BPI / VYBE by BPI." and "You received ₱1.00 from Maya Savings". "You paid" is a likely wording that has not been seen yet. */
const maya: Parser = (_title, body) => {
  // "Payment of ₱5,000.00 received on your Maya Black": a card payment landing on that account (lowers what is owed).
  const card = new RegExp(String.raw`payment\s+of\s+${CUR}${AMT}\s+(?:has\s+been\s+)?received\s+(?:on|for)\s+your\s+(.+?)\.?$`, 'i').exec(body);
  if (card) {
    const amount = centavos(card[1]);
    return amount === null ? null : make({ source: 'maya', direction: 'in', amount, counterparty: null, accountName: clean(card[2]) });
  }
  const rcv =new RegExp(String.raw`received\s+${CUR}${AMT}\s+from\s+(.+?)\.?$`, 'i').exec(body);
  if (rcv) {
    const amount = centavos(rcv[1]);
    return amount === null ? null : make({ source: 'maya', direction: 'in', amount, counterparty: clean(rcv[2]) });
  }
  // "You received 100 in your wallet via InstaPay": money in with no sender shown.
  const wallet = new RegExp(String.raw`received\s+${CUR}${AMT}\s+in\s+your\s+wallet(?:\s+via\s+(.+?))?\.?$`, 'i').exec(body);
  if (wallet) {
    const amount = centavos(wallet[1]);
    return amount === null ? null : make({ source: 'maya', direction: 'in', amount, counterparty: clean(wallet[2]) });
  }
  const out = new RegExp(String.raw`(?:transferred|paid|sent)\s+${CUR}${AMT}\s+to\s+(.+?)\.?$`, 'i').exec(body);
  if (out) {
    const amount = centavos(out[1]);
    return amount === null ? null : make({ source: 'maya', direction: 'out', amount, counterparty: clean(out[2]) });
  }
  return null;
};

/** GoTyme. "You received ₱1.00 from K. A. T. DOCOT." and "You sent P1.00 to NAME Bank Of The Philippine Islands (BPI) ••••••8167." */
const gotyme: Parser = (_title, body) => {
  const rcv = new RegExp(String.raw`received\s+${CUR}${AMT}\s+from\s+(.+?)\.?$`, 'i').exec(body);
  if (rcv) {
    const amount = centavos(rcv[1]);
    return amount === null ? null : make({ source: 'gotyme', direction: 'in', amount, counterparty: clean(rcv[2]) });
  }
  const sent = new RegExp(String.raw`sent\s+${CUR}${AMT}\s+to\s+(.+?)(?:\s+[•*]{2,}(\d{2,4}))?\.?$`, 'i').exec(body);
  if (sent) {
    const amount = centavos(sent[1]);
    return amount === null ? null : make({ source: 'gotyme', direction: 'out', amount, counterparty: clean(sent[2]), counterpartyLast4: sent[3] ?? null });
  }
  return null;
};

/** MariBank. "You've received PHP 34,990.00 from GrabPay with account ending 4615." and "An InstaPay transfer of PHP 1.00 to NAME on 21 Nov 2026 12:11 was completed." */
const maribank: Parser = (_title, body) => {
  const rcv = new RegExp(String.raw`received\s+${CUR}${AMT}\s+from\s+(.+?)(?:\s+with account ending\s+(\d{2,4}))?\.?$`, 'i').exec(body);
  if (rcv) {
    const amount = centavos(rcv[1]);
    return amount === null ? null : make({ source: 'maribank', direction: 'in', amount, counterparty: clean(rcv[2]), counterpartyLast4: rcv[3] ?? null });
  }
  const out = new RegExp(String.raw`transfer of\s+${CUR}${AMT}\s+to\s+(.+?)\s+on\s+\d`, 'i').exec(body);
  if (out) {
    const amount = centavos(out[1]);
    return amount === null ? null : make({ source: 'maribank', direction: 'out', amount, counterparty: clean(out[2]) });
  }
  return null;
};

/** BPI push (its alerts may not fire on every phone; the BPI emails in E7 are the main route). "Your account XXXXXXX644 has been credited PHP 100.00 through a deposit via BPI partner store." */
const bpi: Parser = (_title, body) => {
  const cr = new RegExp(String.raw`account\s+[Xx*]*(\d{2,4})\s+has been credited\s+${CUR}${AMT}`, 'i').exec(body);
  if (cr) {
    const amount = centavos(cr[2]);
    return amount === null ? null : make({ source: 'bpi', direction: 'in', amount, accountHint: cr[1]!, counterparty: /through\s+(?:a\s+)?(.+?)\.?$/i.exec(body)?.[1]?.slice(0, 80) ?? null });
  }
  const dr = new RegExp(String.raw`account\s+[Xx*]*(\d{2,4})\s+has been debited\s+${CUR}${AMT}`, 'i').exec(body);
  if (dr) {
    const amount = centavos(dr[2]);
    return amount === null ? null : make({ source: 'bpi', direction: 'out', amount, accountHint: dr[1]!, counterparty: null });
  }
  return null;
};

const PARSERS: Partial<Record<SourceKey, Parser>> = { gcash, maya, gotyme, maribank, bpi };

/** True when this source has a notification parser (Grab, foodpanda and Google Wallet do not yet). */
export const canParse = (source: SourceKey, patterns: readonly CapturePattern[] = []): boolean => source in PARSERS || patterns.some((p) => p.source === source);

/**
 * Reads one notification. Uses the expanded text when there is one (it is not cut off), and returns null for anything
 * that is not a money movement, such as promos, so nothing unrelated reaches the Inbox.
 */
export function parseNotification(source: SourceKey, n: RawNotification, patterns: readonly CapturePattern[] = []): Parsed | null {
  const body = (n.bigText && n.bigText.length >= (n.text?.length ?? 0) ? n.bigText : n.text) ?? '';
  if (!body) return null;
  // Your own patterns come first, so you can fix or replace a built-in reader without waiting for an update.
  const mine = parseWithPatterns(patterns, source, body);
  if (mine) return mine;
  const parser = PARSERS[source];
  return parser ? parser(n.title ?? '', body) : null;
}

/** What a pattern would read from a sample message, for the "try it" box. Nothing is saved. */
export function testPattern(template: string, direction: 'in' | 'out', sample: string): { ok: true; parsed: Parsed | null } | { ok: false; error: string } {
  const c = compileTemplate(template);
  if (!c.ok) return { ok: false, error: c.error };
  return { ok: true, parsed: parseWithPatterns([{ id: 'test', source: 'custom', template, direction }], 'custom', sample) };
}

/** Tries each of your patterns for this source, in the order you made them; the first that matches wins. */
export function parseWithPatterns(patterns: readonly CapturePattern[], source: SourceKey, body: string): Parsed | null {
  for (const p of patterns) {
    if (p.source !== source) continue;
    const c = compileTemplate(p.template);
    if (!c.ok) continue;
    const m = c.value.regex.exec(body);
    if (!m) continue;
    const amount = centavos(m[c.value.groups.amount!]);
    if (amount === null) continue;
    const g = c.value.groups;
    return make({
      source,
      direction: p.direction,
      amount,
      counterparty: g.name ? clean(m[g.name]) : null,
      accountHint: g.last4 ? (m[g.last4] ?? null) : null,
      ref: g.ref ? (m[g.ref] ?? null) : null,
    });
  }
  return null;
}

/** The words keyword rules look at. Used for matching only, never stored. */
export const matchText = (n: RawNotification): string => [n.title, n.text, n.bigText].filter(Boolean).join(' ');

