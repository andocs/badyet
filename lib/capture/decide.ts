import type { CaptureRule, SourceConfig, SourceKey } from './sources';

/** What the parsers hand over. `text` is used only for keyword matching and is never stored. */
export interface Captured {
  source: SourceKey;
  /** Centavos, always positive. */
  amount: number;
  direction: 'in' | 'out';
  text: string;
}

export type Decision =
  | { keep: false; reason: 'source-off' | 'under-minimum' | 'ignore-rule' }
  | { keep: true; status: 'pending' | 'confirmed'; accountId: string | null; categoryId: string | null; ruleId: string | null };

/** Rules for this source come before rules for every source; longer keywords before shorter; then by id so the order is stable. */
function ordered(rules: readonly CaptureRule[], source: SourceKey): CaptureRule[] {
  return rules
    .filter((r) => r.source === null || r.source === source)
    .sort((a, b) => Number(b.source === source) - Number(a.source === source) || b.matchText.length - a.matchText.length || a.id.localeCompare(b.id));
}

const hit = (r: CaptureRule, haystack: string) => haystack.includes(r.matchText.trim().toLowerCase());

/**
 * Turns a captured notification into what to do with it: skip it, or keep it as pending (or confirmed, if you allowed that).
 * Auto-confirm only happens when it is safe: an account is known and, for spending, a category too. Otherwise it waits in the Inbox.
 */
export function decide(c: Captured, config: SourceConfig, rules: readonly CaptureRule[]): Decision {
  if (!config.enabled) return { keep: false, reason: 'source-off' };
  if (c.amount < config.minAmount) return { keep: false, reason: 'under-minimum' };

  const haystack = c.text.toLowerCase();
  const matched = ordered(rules, c.source).filter((r) => hit(r, haystack));
  if (matched.some((r) => r.action === 'ignore')) return { keep: false, reason: 'ignore-rule' };

  const catRule = c.direction === 'out' ? matched.find((r) => r.action === 'set_category') : undefined;
  const categoryId = c.direction === 'out' ? (catRule?.categoryId ?? config.categoryId) : null;
  const confirmRule = matched.find((r) => r.action === 'auto_confirm');
  const wantsConfirm = config.autoConfirm || confirmRule !== undefined;
  const safe = config.accountId !== null && (c.direction === 'in' || categoryId !== null);

  return {
    keep: true,
    status: wantsConfirm && safe ? 'confirmed' : 'pending',
    accountId: config.accountId,
    categoryId,
    ruleId: (catRule ?? confirmRule)?.id ?? null,
  };
}
