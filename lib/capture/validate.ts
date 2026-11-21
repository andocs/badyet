import { parsePesos } from '@/lib/domain/money';
import { isSource, RULE_ACTIONS, type RuleAction, type SourceKey } from './sources';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PACKAGE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
}

export function validateSource(i: SourceInput): Result<SourceValue> {
  if (!isSource(i.source)) return { ok: false, error: 'That source was not found.' };
  const packages = splitList(i.packages).map((p) => p.toLowerCase());
  if (packages.length > 10) return { ok: false, error: 'Up to 10 apps per source.' };
  if (packages.some((p) => !PACKAGE.test(p))) return { ok: false, error: 'An app id looks like com.example.app.' };
  const senders = splitList(i.senders).map((s) => s.toLowerCase());
  if (senders.length > 10) return { ok: false, error: 'Up to 10 email senders per source.' };
  if (senders.some((s) => !EMAIL.test(s))) return { ok: false, error: 'An email sender looks like name@bank.com.' };
  if (i.accountId !== null && !UUID.test(i.accountId)) return { ok: false, error: 'Pick an account from the list.' };
  if (i.categoryId !== null && !UUID.test(i.categoryId)) return { ok: false, error: 'Pick a category from the list.' };
  const typed = i.minAmount.trim();
  const min = typed === '' ? 0 : parsePesos(typed);
  if (min === undefined || min < 0) return { ok: false, error: 'Minimum amount is pesos, like 50 or 1,250.50.' };
  if (min > MAX_CENTAVOS) return { ok: false, error: 'That minimum is too large.' };
  return {
    ok: true,
    value: { source: i.source, enabled: i.enabled, packages, senders, accountId: i.accountId, categoryId: i.categoryId, autoConfirm: i.autoConfirm, minAmount: min },
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
