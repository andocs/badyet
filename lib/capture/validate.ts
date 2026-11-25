import { parsePesos } from '@/lib/domain/money';
import { isSource, RULE_ACTIONS, RULE_CHANNELS, RULE_KINDS, type RuleAction, type RuleChannel, type RuleKind, type SourceKey, isCustomSlot } from './sources';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PACKAGE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i;
// An address, or a whole domain written "@bank.com".
const EMAIL = /^([^\s@]+)?@[^\s@]+\.[^\s@]+$/;
const MAX_CENTAVOS = 100_000_000_000;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Splits "a, b\nc" into trimmed, unique, non-empty items. */
export const splitList = (text: string): string[] => [...new Set(text.split(/[,\n;\s]+/).map((s) => s.trim()).filter(Boolean))];

export interface SourceInput {
  source: string;
  enabled: boolean;
  /** Comma or line separated. */
  packages: string;
  senders: string;
  accountId: string | null;
  categoryId: string | null;
  autoConfirm: boolean;
  /** Pesos as typed; empty means no minimum. */
  minAmount: string;
  /** The name of an "Other app" source; ignored for the built-in ones. */
  label?: string;
}

export interface SourceValue {
  source: SourceKey;
  enabled: boolean;
  packages: string[];
  senders: string[];
  accountId: string | null;
  categoryId: string | null;
  autoConfirm: boolean;
  minAmount: number;
  /** Set only for "Other app" sources; null = the default name. */
  label: string | null;
}

export function validateSource(i: SourceInput): Result<SourceValue> {
  if (!isSource(i.source)) return { ok: false, error: 'That source was not found.' };
  const packages = splitList(i.packages).map((p) => p.toLowerCase());
  if (packages.length > 10) return { ok: false, error: 'Up to 10 apps per source.' };
  if (packages.some((p) => !PACKAGE.test(p))) return { ok: false, error: 'An app id looks like com.example.app.' };
  const senders = splitList(i.senders).map((s) => s.toLowerCase());
  if (senders.length > 10) return { ok: false, error: 'Up to 10 email senders per source.' };
  if (senders.some((s) => !EMAIL.test(s))) return { ok: false, error: 'An email sender looks like name@bank.com, or @bank.com for the whole bank.' };
  if (i.accountId !== null && !UUID.test(i.accountId)) return { ok: false, error: 'Pick an account from the list.' };
  if (i.categoryId !== null && !UUID.test(i.categoryId)) return { ok: false, error: 'Pick a category from the list.' };
  const typed = i.minAmount.trim();
  const min = typed === '' ? 0 : parsePesos(typed);
  if (min === undefined || min < 0) return { ok: false, error: 'Minimum amount is pesos, like 50 or 1,250.50.' };
  if (min > MAX_CENTAVOS) return { ok: false, error: 'That minimum is too large.' };
  const typedLabel = (i.label ?? '').trim().replace(/\s+/g, ' ');
  if (typedLabel.length > 30) return { ok: false, error: 'Keep the name under 30 characters.' };
  const label = isCustomSlot(i.source) && typedLabel !== '' ? typedLabel : null;
  return {
    ok: true,
    value: { source: i.source, enabled: i.enabled, packages, senders, accountId: i.accountId, categoryId: i.categoryId, autoConfirm: i.autoConfirm, minAmount: min, label },
  };
}

export interface RuleInput {
  /** null or '' = every source. */
  source: string | null;
  matchText: string;
  action: string;
  categoryId: string | null;
}

export interface RuleValue {
  source: SourceKey | null;
  matchText: string;
  action: RuleAction;
  categoryId: string | null;
}

export function validateRule(i: RuleInput): Result<RuleValue> {
  const source = i.source === null || i.source === '' ? null : i.source;
  if (source !== null && !isSource(source)) return { ok: false, error: 'That source was not found.' };
  const matchText = i.matchText.replace(/\s+/g, ' ').trim();
  if (matchText.length < 1) return { ok: false, error: 'Type the words to look for.' };
  if (matchText.length > 80) return { ok: false, error: 'Keep the words to 80 characters.' };
  if (!(RULE_ACTIONS as readonly string[]).includes(i.action)) return { ok: false, error: 'Pick what to do.' };
  const action = i.action as RuleAction;
  if (action === 'set_category') {
    if (!i.categoryId || !UUID.test(i.categoryId)) return { ok: false, error: 'Pick a category.' };
    return { ok: true, value: { source, matchText, action, categoryId: i.categoryId } };
  }
  return { ok: true, value: { source, matchText, action, categoryId: null } };
}

export interface RuleFullInput {
  name: string;
  enabled: boolean;
  channel: string;
  /** Any of these. */
  words: string[];
  mustWords: string[];
  skipWords: string[];
  sources: string[];
  packages: string[];
  senders: string[];
  /** 'ignore' for a rule that drops what it matches, otherwise 'record'. */
  action: string;
  kind: string;
  categoryId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  autoConfirm: boolean;
}

export interface RuleFullValue {
  name: string | null;
  enabled: boolean;
  channel: RuleChannel;
  words: string[];
  mustWords: string[];
  skipWords: string[];
  sources: SourceKey[];
  packages: string[];
  senders: string[];
  action: 'ignore' | 'record';
  kind: RuleKind;
  categoryId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  autoConfirm: boolean;
}

const SENDER = /^(@[^\s@]+\.[^\s@]+|[^\s@]+@[^\s@]+\.[^\s@]+)$/;

/** Checks the rule the Rules page saves. Words are trimmed, lower-cased and de-duplicated; at most 10 of each kind. */
export function validateRuleFull(i: RuleFullInput): Result<RuleFullValue> {
  const clean = (list: string[]) => [...new Set(list.map((w) => w.replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean))];
  const words = clean(i.words);
  const mustWords = clean(i.mustWords);
  const skipWords = clean(i.skipWords);
  for (const [label, list] of [['look-for', words], ['must-have', mustWords], ['skip', skipWords]] as const) {
    if (list.length > 10) return { ok: false, error: `Up to 10 ${label} words.` };
    if (list.some((w) => w.length > 80)) return { ok: false, error: 'Keep each word or phrase to 80 characters.' };
  }
  if (words.length === 0) return { ok: false, error: 'Add at least one word to look for.' };
  const name = i.name.replace(/\s+/g, ' ').trim();
  if (name.length > 60) return { ok: false, error: 'Keep the name to 60 characters.' };
  if (!(RULE_CHANNELS as readonly string[]).includes(i.channel)) return { ok: false, error: 'Pick where to listen.' };
  if (!(RULE_KINDS as readonly string[]).includes(i.kind)) return { ok: false, error: 'Pick what it is.' };
  if (i.action !== 'ignore' && i.action !== 'record') return { ok: false, error: 'Pick what to do.' };
  const sources = [...new Set(i.sources)];
  if (sources.some((s) => !isSource(s))) return { ok: false, error: 'That source was not found.' };
  const packages = clean(i.packages);
  const senders = clean(i.senders);
  if (sources.length > 10 || packages.length > 10 || senders.length > 10) return { ok: false, error: 'Up to 10 places per rule.' };
  if (packages.some((p) => !PACKAGE.test(p))) return { ok: false, error: 'An app id looks like com.example.app.' };
  if (senders.some((s) => !SENDER.test(s))) return { ok: false, error: 'A sender looks like name@bank.com or @bank.com.' };
  for (const id of [i.categoryId, i.fromAccountId, i.toAccountId]) if (id !== null && !UUID.test(id)) return { ok: false, error: 'Pick from the list.' };
  const moves = i.action === 'record' && (i.kind === 'transfer' || i.kind === 'payment');
  if (moves && i.fromAccountId !== null && i.fromAccountId === i.toAccountId) return { ok: false, error: 'Pick two different accounts.' };
  return {
    ok: true,
    value: {
      name: name || null,
      enabled: i.enabled,
      channel: i.channel as RuleChannel,
      words,
      mustWords,
      skipWords,
      sources: sources as SourceKey[],
      packages,
      senders,
      action: i.action,
      kind: i.kind as RuleKind,
      categoryId: i.kind === 'spending' && i.action === 'record' ? i.categoryId : null,
      fromAccountId: moves ? i.fromAccountId : null,
      toAccountId: moves ? i.toAccountId : null,
      autoConfirm: i.action === 'record' && i.autoConfirm,
    },
  };
}

/** The row to save for a validated rule. `match_text` keeps the first word so older code that only knows it still works. */
export function ruleFullRow(v: RuleFullValue) {
  return {
    name: v.name,
    enabled: v.enabled,
    channel: v.channel,
    match_text: v.words[0]!.slice(0, 80),
    words: v.words,
    must_words: v.mustWords,
    skip_words: v.skipWords,
    sources: v.sources,
    packages: v.packages,
    senders: v.senders,
    action: v.action,
    kind: v.kind,
    category_id: v.categoryId,
    from_account_id: v.fromAccountId,
    to_account_id: v.toAccountId,
    auto_confirm: v.autoConfirm,
  };
}
