import type { CaptureRule, SourceConfig, SourceKey } from './sources';

/** What the parsers hand over. `text` is used only for keyword matching and is never stored. */
export interface Captured {
  source: SourceKey;
  /** Centavos, always positive. */
  amount: number;
  direction: 'in' | 'out';
  text: string;
  /** Where it came from, for rules limited to notifications or emails. Left out = unknown, so channel does not limit anything. */
  channel?: 'notification' | 'email';
  /** The Android app id (notifications) or the sender address (emails), for rules that name extra apps or senders. */
  from?: string;
}

/** A transfer or card payment: both accounts are known, so both halves can be recorded. */
export interface TransferPlan {
  fromAccountId: string;
  toAccountId: string;
}

export type Decision =
  | { keep: false; reason: 'source-off' | 'under-minimum' | 'ignore-rule' }
  | { keep: true; status: 'pending' | 'confirmed'; accountId: string | null; categoryId: string | null; ruleId: string | null; transfer?: TransferPlan };

/** Rules for this source come before rules for every source; longer keywords before shorter; then by id so the order is stable. Rules saved with a position keep that order first. */
function ordered(rules: readonly CaptureRule[], source: SourceKey): CaptureRule[] {
  return rules
    .filter((r) => r.enabled !== false)
    .sort(
      (a, b) =>
        (a.position ?? 0) - (b.position ?? 0) ||
        Number(b.source === source) - Number(a.source === source) ||
        b.matchText.length - a.matchText.length ||
        a.id.localeCompare(b.id),
    );
}

const lower = (list: readonly string[] | undefined) => (list ?? []).map((w) => w.trim().toLowerCase()).filter(Boolean);

/** An email sender matches an exact address, or a whole domain written @bank.com. */
const senderHit = (list: readonly string[], from: string) => {
  const f = from.trim().toLowerCase();
  return list.some((s) => {
    const x = s.trim().toLowerCase();
    return x.startsWith('@') ? f.endsWith(x) : f === x;
  });
};

/** Does the rule apply to where this capture came from? No limits at all means everywhere. */
function inScope(r: CaptureRule, c: Captured): boolean {
  if (r.channel === 'notifications' && c.channel === 'email') return false;
  if (r.channel === 'emails' && c.channel === 'notification') return false;
  const sources = r.sources ?? [];
  const packages = lower(r.packages);
  const senders = r.senders ?? [];
  if (r.source === null && sources.length === 0 && packages.length === 0 && senders.length === 0) return true;
  if (r.source === c.source || sources.includes(c.source)) return true;
  if (c.from && c.channel !== 'email' && packages.includes(c.from.toLowerCase())) return true;
  if (c.from && c.channel !== 'notification' && senderHit(senders, c.from)) return true;
  return false;
}

/** The words test: any of the words, all of the must-words, none of the skip-words. A rule with no words of its own uses `matchText`. */
export function wordsHit(r: CaptureRule, haystack: string): boolean {
  const any = lower(r.words);
  const anyOf = any.length > 0 ? any : lower([r.matchText]);
  if (anyOf.length > 0 && !anyOf.some((w) => haystack.includes(w))) return false;
  if (lower(r.mustWords).some((w) => !haystack.includes(w))) return false;
  if (lower(r.skipWords).some((w) => haystack.includes(w))) return false;
  return true;
}

/**
 * Turns a captured notification into what to do with it: skip it, or keep it as pending (or confirmed, if you allowed that).
 * Auto-confirm only happens when it is safe: an account is known and, for spending, a category too. Otherwise it waits in the Inbox.
 * An ignore rule always wins. Otherwise the first matching "record" rule (top to bottom) decides what it is; a transfer or payment
 * with both accounts named is recorded on both.
 */
export function decide(c: Captured, config: SourceConfig, rules: readonly CaptureRule[]): Decision {
  if (!config.enabled) return { keep: false, reason: 'source-off' };
  if (c.amount < config.minAmount) return { keep: false, reason: 'under-minimum' };

  const haystack = c.text.toLowerCase();
  const matched = ordered(rules, c.source).filter((r) => inScope(r, c) && wordsHit(r, haystack));
  if (matched.some((r) => r.action === 'ignore')) return { keep: false, reason: 'ignore-rule' };

  const rec = matched.find((r) => r.action === 'record');
  const movesBetweenYours = rec !== undefined && (rec.kind === 'transfer' || rec.kind === 'payment') && !!rec.fromAccountId && !!rec.toAccountId && rec.fromAccountId !== rec.toAccountId;
  if (rec && movesBetweenYours) {
    return {
      keep: true,
      status: config.autoConfirm || rec.autoConfirm ? 'confirmed' : 'pending',
      accountId: c.direction === 'out' ? rec.fromAccountId! : rec.toAccountId!,
      categoryId: null,
      ruleId: rec.id,
      transfer: { fromAccountId: rec.fromAccountId!, toAccountId: rec.toAccountId! },
    };
  }

  const catRule = c.direction === 'out' ? matched.find((r) => r.action === 'set_category' || (r.action === 'record' && r.kind !== 'income' && r.categoryId)) : undefined;
  const categoryId = c.direction === 'out' ? (catRule?.categoryId ?? config.categoryId) : null;
  const confirmRule = matched.find((r) => r.action === 'auto_confirm' || (r.action === 'record' && r.autoConfirm));
  const wantsConfirm = config.autoConfirm || confirmRule !== undefined;
  const accountId = rec?.fromAccountId && c.direction === 'out' ? rec.fromAccountId : (rec?.toAccountId && c.direction === 'in' ? rec.toAccountId : config.accountId);
  const safe = accountId !== null && (c.direction === 'in' || categoryId !== null);

  return {
    keep: true,
    status: wantsConfirm && safe ? 'confirmed' : 'pending',
    accountId,
    categoryId,
    ruleId: (catRule ?? confirmRule ?? rec)?.id ?? null,
  };
}
