import { decide, type Decision } from './decide';
import { parseEmail } from './email';
import { findTransferPairs } from './pair';
import { parseNotification, parseWithPatterns, type Parsed } from './parsers';
import type { CapturePattern } from './patterns';
import { placeCapture } from './place';
import { accountWords, type AccountLite } from './row';
import { type CaptureRule, type SourceConfig, type SourceKey } from './sources';

/**
 * What the Rules editor shows about reading and results: the wordings each built-in reader knows, what a pasted sample would do, and
 * whether the other side's message would pair with it. The web and the phone share this.
 */

export type Channel = 'notification' | 'email';

export interface BuiltinFormat {
  /** What kind of message it is. */
  label: string;
  /** The wording in plain form; {curly} parts change from message to message. */
  wording: string;
  /** What is taken from it. */
  reads: string;
  /** A made-up message the reader really does read (checked by a test). For an email, its first line is the subject. */
  example: string;
}

const email = (lines: string[]) => lines.join('\n');

export const BUILTIN_FORMATS: Partial<Record<SourceKey, Partial<Record<Channel, BuiltinFormat[]>>>> = {
  gcash: {
    notification: [
      { label: 'Money in', wording: 'You have received {amount} of GCash from {name} with account ending in {last4}.', reads: 'Amount, who sent it, their last digits (if shown), Ref. No. (if shown)', example: 'You have received 900.00 of GCash from Sample Bank with account ending in 1234.' },
      { label: 'Payment', wording: 'You have paid {amount} of GCash to purchase {name} with a convenience fee of {fee}.', reads: 'Amount plus the fee, and who was paid. "to purchase" and the fee are optional', example: 'You have paid P112.00 of GCash to purchase Sample Load with a convenience fee of P3.00.' },
      { label: 'Money sent', wording: 'You have sent {amount} to {name} on {date}', reads: 'Amount and who you sent it to', example: 'You have sent PHP 500.00 to Sample Person on 11-26-2026.' },
    ],
  },
  maya: {
    notification: [
      { label: 'Card payment', wording: 'Payment of {amount} received on your {card name}', reads: 'Money in. The card name picks the account', example: 'Payment of ₱5,000.00 received on your Maya Black' },
      { label: 'Money sent', wording: 'You transferred {amount} to {name}.', reads: 'Money out. "paid" and "sent" work too', example: 'You transferred ₱500.00 to Sample Person.' },
      { label: 'Money in', wording: 'You received {amount} from {name}', reads: 'Money in and who sent it', example: 'You received ₱250.00 from Sample Person' },
      { label: 'Into your wallet', wording: 'You received {amount} in your wallet via {channel}', reads: 'Money in. "via …" is optional', example: 'You received ₱100.00 in your wallet via InstaPay' },
    ],
  },
  gotyme: {
    notification: [
      { label: 'Money in', wording: 'You received {amount} from {name}', reads: 'Amount and who sent it', example: 'You received ₱250.00 from Sample Person' },
      { label: 'Money sent', wording: 'You sent {amount} to {name} ••••{last4}', reads: 'Amount, who you sent it to, their last digits (if shown)', example: 'You sent P100.00 to Sample Person Sample Bank ••••••1234.' },
    ],
  },
  maribank: {
    notification: [
      { label: 'Money in', wording: "You've received {amount} from {name} with account ending {last4}.", reads: 'Amount, who sent it, their last digits (if shown)', example: "You've received PHP 250.00 from Sample Pay with account ending 1234." },
      { label: 'Money sent', wording: 'An InstaPay transfer of {amount} to {name} on {date} was completed.', reads: 'Amount and who it went to', example: 'An InstaPay transfer of PHP 100.00 to Sample Person on 26 Nov 2026 12:11 was completed.' },
    ],
  },
  bpi: {
    notification: [
      { label: 'Money in', wording: 'Your account {last4} has been credited {amount} through {channel}.', reads: 'Amount and your account’s last digits', example: 'Your account XXXXXXX123 has been credited PHP 100.00 through a deposit via a sample store.' },
      { label: 'Money out', wording: 'Your account {last4} has been debited {amount}', reads: 'Amount and your account’s last digits', example: 'Your account XXXXXXX123 has been debited PHP 100.00' },
    ],
    email: [
      { label: 'Transfer out', wording: 'Lines: Transfer From, Transfer To, Bank Name, Total Amount, Confirmation Number', reads: 'Amount, your account, the receiving bank and its digits', example: email(['Interbank Funds Transfer Confirmation', 'Confirmation Number: R100000000', 'Transfer From: XXXX-XXXX-123 (Sample Savings)', 'Transfer To: 01XXXXXX00654', 'Bank Name: Sample Bank', 'Total Amount: PHP 100.00']) },
      { label: 'Transfer in', wording: 'Lines: Reference Number, Transfer From, Transfer To, Bank Name, Transfer Amount', reads: 'Amount, your account, the sending bank and its digits', example: email(['Incoming Interbank Funds Transfer Confirmation', 'Reference Number: 20261126SAMPLE', 'Transfer From: XXXXXXXX0325', 'Transfer To: XXXXXXXXXX8167', 'Bank Name: Sample Bank', 'Transfer Amount: PHP 100.00']) },
    ],
  },
  grab: {
    email: [{ label: 'Receipt', wording: 'Lines: TOTAL (INCL. TAX), Booking code, Pick up location, Payment Method', reads: 'Amount, the pick-up place, and card digits. Cash rides are skipped', example: email(['Your Grab E-Receipt', 'TOTAL (INCL. TAX): ₱ 250.00', 'Booking code: A-SAMPLE123', 'Pick up location: Sample Eatery', 'Payment Method: Visa 1234']) }],
  },
  foodpanda: {
    email: [{ label: 'Order', wording: 'Lines: Order number, Store, Order Total', reads: 'Amount and the store', example: email(['Your order has been placed', 'Order number: samp-1234-abcd', 'Store: Sample Kitchen', 'Order Total: ₱250.00']) }],
  },
};

export interface SampleRead {
  parsed: Parsed;
  by: 'pattern' | 'builtin';
  channel: Channel;
}

const notificationOf = (text: string) => ({ title: null, text, bigText: null });
const emailOf = (text: string) => ({ subject: text.split('\n')[0] ?? '', text });

/** What a source reads from a pasted message, as a notification or as an email. null = the app would ignore it. */
export function readSample(source: SourceKey, text: string, patterns: readonly CapturePattern[], channels: readonly Channel[] = ['notification', 'email']): SampleRead | null {
  const body = text.trim();
  if (body === '') return null;
  for (const channel of channels) {
    const parsed = channel === 'notification' ? parseNotification(source, notificationOf(body), patterns) : parseEmail(source, emailOf(body), patterns);
    if (parsed) return { parsed, channel, by: parseWithPatterns(patterns, source, body) ? 'pattern' : 'builtin' };
  }
  return null;
}

export interface SampleEntry {
  accountId: string | null;
  /** Centavos, negative = money out. */
  amount: number;
  kind: 'expense' | 'income' | 'transfer';
}

export type SampleOutcome =
  | { kind: 'unreadable' }
  | { kind: 'skipped'; read: SampleRead; reason: Extract<Decision, { keep: false }>['reason'] }
  | { kind: 'kept'; read: SampleRead; decision: Extract<Decision, { keep: true }>; accountId: string | null; entries: SampleEntry[] };

export interface SampleSetup {
  source: SourceKey;
  config: SourceConfig;
  rules: readonly CaptureRule[];
  patterns: readonly CapturePattern[];
  accounts: readonly AccountLite[];
  channels?: readonly Channel[];
  /** An app id or sender to treat the sample as coming from, for a rule limited to one. */
  from?: string;
}

/** What a pasted message would do with these settings: ignored, skipped, or what gets saved. */
export function simulate(text: string, s: SampleSetup): SampleOutcome {
  const read = readSample(s.source, text, s.patterns, s.channels);
  if (!read) return { kind: 'unreadable' };
  const p = read.parsed;
  const decision = decide({ source: s.source, amount: p.amount, direction: p.direction, text: text.trim(), channel: read.channel, from: s.from }, s.config, s.rules);
  if (!decision.keep) return { kind: 'skipped', read, reason: decision.reason };
  const { accountId, plan } = placeCapture(decision, p, s.config, s.accounts);
  const signed = p.direction === 'out' ? -p.amount : p.amount;
  const entries: SampleEntry[] = [{ accountId, amount: signed, kind: plan ? 'transfer' : p.direction === 'out' ? 'expense' : 'income' }];
  if (plan && accountId) entries.push({ accountId: accountId === plan.fromAccountId ? plan.toAccountId : plan.fromAccountId, amount: -signed, kind: 'transfer' });
  return { kind: 'kept', read, decision, accountId, entries };
}

export interface PairCheck {
  ok: boolean;
  label: string;
}

/** Whether two captured messages would be joined into one transfer, with each thing that has to be true. */
export function pairCheck(a: Extract<SampleOutcome, { kind: 'kept' }>, b: Extract<SampleOutcome, { kind: 'kept' }>, accounts: readonly AccountLite[]): { pairs: boolean; checks: PairCheck[] } {
  const rows = [a, b].map((o, i) => ({ id: String(i), accountId: o.accountId ?? '', amount: o.read.parsed.direction === 'out' ? -o.read.parsed.amount : o.read.parsed.amount, at: 0, counterparty: o.read.parsed.counterparty }));
  const [x, y] = rows as [(typeof rows)[number], (typeof rows)[number]];
  const names = (who: string | null, id: string) => {
    const account = accounts.find((c) => c.id === id);
    return !!account && accountWords(account).some((w) => (who ?? '').toLowerCase().includes(w));
  };
  const checks: PairCheck[] = [
    { ok: !!x.accountId && !!y.accountId && x.accountId !== y.accountId, label: 'Two different accounts, both known' },
    { ok: Math.sign(x.amount) !== Math.sign(y.amount), label: 'One is money out and one is money in' },
    { ok: Math.abs(x.amount) === Math.abs(y.amount), label: 'Exactly the same amount (a fee on one side stops it)' },
    { ok: names(x.counterparty, y.accountId) || names(y.counterparty, x.accountId), label: 'One message names the other account' },
  ];
  return { pairs: findTransferPairs(rows, accounts).length > 0, checks };
}

/** A first draft of a pattern from a message: the amount (and a reference number, if one is labelled) become placeholders. */
export function suggestPattern(sample: string): string | null {
  const text = sample.trim().replace(/\s+/g, ' ');
  const amount = /(?:PHP|₱|\bP(?=\d))\s?\d[\d,]*(?:\.\d{1,2})?|\b\d[\d,]*\.\d{2}\b/i.exec(text);
  if (!amount) return null;
  let out = text.slice(0, amount.index) + '{amount}' + text.slice(amount.index + amount[0].length);
  out = out.replace(/(Ref(?:erence)?\.?\s*(?:No\.?|Number)?\s*:?\s*)(?=[A-Za-z0-9]*\d)[A-Za-z0-9]+/i, '$1{ref}');
  return out.slice(0, 200);
}

export interface RuleGroup {
  source: SourceKey;
  rules: CaptureRule[];
}

/**
 * The Rules list: each rule under the one source it is limited to, and the rest (several sources, or any) together. The numbers are
 * the order rules are tried across all of them, which grouping does not change.
 */
export function groupRules(rules: readonly CaptureRule[], sources: readonly SourceKey[]): { groups: RuleGroup[]; shared: CaptureRule[]; numberOf: Map<string, number> } {
  const homeOf = (r: CaptureRule): SourceKey | null => {
    const named = [...new Set([...(r.sources ?? []), ...(r.source ? [r.source] : [])])];
    return named.length === 1 && sources.includes(named[0] as SourceKey) ? (named[0] as SourceKey) : null;
  };
  return {
    groups: sources.map((source) => ({ source, rules: rules.filter((r) => homeOf(r) === source) })),
    shared: rules.filter((r) => homeOf(r) === null),
    numberOf: new Map(rules.map((r, i) => [r.id, i + 1])),
  };
}
