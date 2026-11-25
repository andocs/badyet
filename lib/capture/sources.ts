export const SOURCES = ['gcash', 'maya', 'bpi', 'gotyme', 'maribank', 'grab', 'foodpanda', 'gwallet', 'custom', 'custom2', 'custom3', 'custom4', 'custom5', 'custom6'] as const;
export type SourceKey = (typeof SOURCES)[number];

export const isSource = (v: unknown): v is SourceKey => typeof v === 'string' && (SOURCES as readonly string[]).includes(v);

/** The "Other app" slots: sources you make yourself, each with its own name, apps, senders and patterns. */
export const CUSTOM_SLOTS: readonly SourceKey[] = ['custom', 'custom2', 'custom3', 'custom4', 'custom5', 'custom6'];
export const isCustomSlot = (k: SourceKey): boolean => CUSTOM_SLOTS.includes(k);

/** An extra "Other app" slot (2 to 6) still in its starting state: it waits behind the "+ Another app" button instead of showing as removed. */
export const isUnusedSlot = (c: { source: SourceKey; removed: boolean; packages: string[]; senders: string[]; label: string }, patterns: readonly { source: SourceKey }[]): boolean =>
  c.source !== 'custom' && isCustomSlot(c.source) && c.removed && c.packages.length === 0 && c.senders.length === 0 && c.label === SOURCE_INFO[c.source].label && !patterns.some((p) => p.source === c.source);

interface SourceInfo {
  label: string;
  /** What this source sends, in plain words. */
  blurb: string;
  /** Best-guess Android app ids. Fix them in the editor if a notification does not arrive. */
  packages: string[];
  /** Email senders for the Gmail side. */
  senders: string[];
  /** Email domains recognised even when no sender is listed (best guess). */
  domains: string[];
}

export const SOURCE_INFO: Record<SourceKey, SourceInfo> = {
  gcash: { label: 'GCash', blurb: 'App notifications: money in and out.', packages: ['com.globe.gcash.android'], senders: [], domains: [] },
  maya: { label: 'Maya', blurb: 'App notifications: money in and out.', packages: ['com.paymaya'], senders: [], domains: [] },
  bpi: { label: 'BPI', blurb: 'Emails from BPI online banking and InstaPay.', packages: [], senders: ['onlinebanking@bpi.com.ph', 'bpiinstapay@bpi.com.ph'], domains: ['bpi.com.ph'] },
  gotyme: { label: 'GoTyme', blurb: 'App notifications: transfers in and out.', packages: [], senders: [], domains: [] },
  maribank: { label: 'MariBank', blurb: 'App notifications: transfers in and out.', packages: [], senders: [], domains: [] },
  grab: { label: 'Grab', blurb: 'Receipts for rides and food.', packages: [], senders: ['no-reply@grab.com'], domains: ['grab.com'] },
  foodpanda: { label: 'foodpanda', blurb: 'Order receipts.', packages: [], senders: ['info@mail.foodpanda.ph'], domains: ['foodpanda.com','foodpanda.ph'] },
  custom: { label: 'Other app', blurb: 'Any app you set up yourself: add its app id and your own patterns.', packages: [], senders: [], domains: [] },
  gwallet: { label: 'Google Wallet', blurb: 'Tap-to-pay notifications.', packages: ['com.google.android.apps.walletnfcrel'], senders: [], domains: [] },
  custom2: { label: 'Other app 2', blurb: 'Another app you set up yourself.', packages: [], senders: [], domains: [] },
  custom3: { label: 'Other app 3', blurb: 'Another app you set up yourself.', packages: [], senders: [], domains: [] },
  custom4: { label: 'Other app 4', blurb: 'Another app you set up yourself.', packages: [], senders: [], domains: [] },
  custom5: { label: 'Other app 5', blurb: 'Another app you set up yourself.', packages: [], senders: [], domains: [] },
  custom6: { label: 'Other app 6', blurb: 'Another app you set up yourself.', packages: [], senders: [], domains: [] },
};

/** How one source is handled. A source with no saved row uses these defaults. */
export interface SourceConfig {
  source: SourceKey;
  enabled: boolean;
  packages: string[];
  senders: string[];
  accountId: string | null;
  categoryId: string | null;
  autoConfirm: boolean;
  /** Centavos. */
  minAmount: number;
  /** Removed from the Rules list (a built-in reader is never deleted; Add back restores it). A removed source is also off. */
  removed: boolean;
  /** What it is called: its built-in name, or the name you gave an "Other app" source. */
  label: string;
}

export const defaultConfig = (source: SourceKey): SourceConfig => ({
  source,
  enabled: true,
  packages: [...SOURCE_INFO[source].packages],
  senders: [...SOURCE_INFO[source].senders],
  accountId: null,
  categoryId: null,
  autoConfirm: false,
  minAmount: 0,
  // "Other app 2..6" stay out of the list until you add them.
  removed: source !== 'custom' && isCustomSlot(source),
  label: SOURCE_INFO[source].label,
});

/** 'record' is the Rules page's rule: say what the capture is (spending, income, transfer, payment) and what to do with it. The other three are the older keyword rules. */
export type RuleAction = 'ignore' | 'set_category' | 'auto_confirm' | 'record';
export const RULE_ACTIONS: readonly RuleAction[] = ['ignore', 'set_category', 'auto_confirm', 'record'];

export const ACTION_LABEL: Record<RuleAction, string> = {
  ignore: 'Ignore it',
  set_category: 'Put it under a category',
  auto_confirm: 'Confirm it without asking',
  record: 'Record it',
};

export type RuleChannel = 'notifications' | 'emails' | 'both';
export const RULE_CHANNELS: readonly RuleChannel[] = ['notifications', 'emails', 'both'];
export type RuleKind = 'spending' | 'income' | 'transfer' | 'payment';
export const RULE_KINDS: readonly RuleKind[] = ['spending', 'income', 'transfer', 'payment'];

/**
 * A capture rule: when a notification or email matches, do `action`. A rule made on the Rules page fills the optional fields;
 * an older keyword rule leaves them out and means "contains `matchText`, on any channel, from `source`".
 */
export interface CaptureRule {
  id: string;
  /** null = every source. */
  source: SourceKey | null;
  matchText: string;
  action: RuleAction;
  categoryId: string | null;
  name?: string | null;
  /** false = switched off. */
  enabled?: boolean;
  channel?: RuleChannel;
  /** Any of these words (when empty, `matchText`). */
  words?: string[];
  /** All of these must also appear. */
  mustWords?: string[];
  /** None of these may appear. */
  skipWords?: string[];
  /** More places it applies to: named sources, extra Android app ids, extra email senders (name@bank.com or @bank.com). Empty everywhere = all. */
  sources?: SourceKey[];
  packages?: string[];
  senders?: string[];
  kind?: RuleKind;
  /** Transfer and payment: where the money leaves and where it arrives. */
  fromAccountId?: string | null;
  toAccountId?: string | null;
  autoConfirm?: boolean;
  /** Top to bottom; the first match decides. */
  position?: number;
}

/** Row shapes as they come from the database. */
export interface SourceRow {
  source: string;
  enabled: boolean;
  packages: string[];
  senders: string[];
  account_id: string | null;
  category_id: string | null;
  auto_confirm: boolean;
  min_amount: number;
  /** Added in rev-38; absent on a database without that update. */
  removed?: boolean;
  /** Added in rev-39: the name of an "Other app" source. */
  label?: string | null;
}
export interface RuleRow {
  id: string;
  source: string | null;
  match_text: string;
  action: string;
  category_id: string | null;
  // Added by the Rules page migration; absent on a database that has not applied it.
  name?: string | null;
  enabled?: boolean;
  channel?: string;
  words?: string[];
  must_words?: string[];
  skip_words?: string[];
  sources?: string[];
  packages?: string[];
  senders?: string[];
  kind?: string;
  from_account_id?: string | null;
  to_account_id?: string | null;
  auto_confirm?: boolean;
  position?: number;
}

/** Every source, with saved choices laid over the defaults. Unknown rows are ignored. */
export function configsFromRows(rows: readonly SourceRow[]): SourceConfig[] {
  const saved = new Map(rows.filter((r) => isSource(r.source)).map((r) => [r.source as SourceKey, r]));
  return SOURCES.map((source) => {
    const r = saved.get(source);
    if (!r) return defaultConfig(source);
    return {
      source,
      enabled: r.enabled,
      packages: r.packages,
      senders: r.senders,
      accountId: r.account_id,
      categoryId: r.category_id,
      autoConfirm: r.auto_confirm,
      minAmount: Number(r.min_amount),
      removed: r.removed ?? false,
      label: (isCustomSlot(source) ? r.label?.trim() : null) || SOURCE_INFO[source].label,
    };
  });
}

export function rulesFromRows(rows: readonly RuleRow[]): CaptureRule[] {
  return rows
    .filter((r) => (r.source === null || isSource(r.source)) && (RULE_ACTIONS as readonly string[]).includes(r.action))
    .map((r) => ({
      id: r.id,
      source: r.source as SourceKey | null,
      matchText: r.match_text,
      action: r.action as RuleAction,
      categoryId: r.category_id,
      name: r.name ?? null,
      enabled: r.enabled ?? true,
      channel: (RULE_CHANNELS as readonly string[]).includes(r.channel ?? '') ? (r.channel as RuleChannel) : 'both',
      words: r.words ?? [],
      mustWords: r.must_words ?? [],
      skipWords: r.skip_words ?? [],
      sources: (r.sources ?? []).filter(isSource),
      packages: r.packages ?? [],
      senders: r.senders ?? [],
      kind: (RULE_KINDS as readonly string[]).includes(r.kind ?? '') ? (r.kind as RuleKind) : 'spending',
      fromAccountId: r.from_account_id ?? null,
      toAccountId: r.to_account_id ?? null,
      autoConfirm: r.auto_confirm ?? false,
      position: r.position ?? 0,
    }));
}

/** The Gmail app. Its notifications are not read: one arriving just means "check Gmail now". */
export const GMAIL_APP = 'com.google.android.gm';

/** Android app ids to listen to: every enabled source's apps, the apps your rules name, plus Gmail when the Gmail alert is on. */
export const allowedPackages = (configs: readonly SourceConfig[], gmailAlert = false, rules: readonly Pick<CaptureRule, 'enabled' | 'packages'>[] = []): string[] => [
  ...new Set([
    ...configs.filter((c) => c.enabled).flatMap((c) => c.packages),
    ...rules.filter((r) => r.enabled).flatMap((r) => r.packages ?? []),
    ...(gmailAlert ? [GMAIL_APP] : []),
  ]),
];

/** The reader for something a rule listens to on its own: the rule's first source, else your own patterns ("Other app"). */
export const ruleSource = (r: Pick<CaptureRule, 'sources' | 'source'>): SourceKey => r.sources?.[0] ?? r.source ?? 'custom';

/**
 * Which source reads a notification from this app: an enabled source that lists it, else a rule that names it (so an app added on
 * a rule is really listened to). Null when nothing asks for it.
 */
export function sourceForPackage(pkg: string, configs: readonly SourceConfig[], rules: readonly CaptureRule[] = []): SourceKey | null {
  const cfg = configs.find((c) => c.enabled && c.packages.includes(pkg));
  if (cfg) return cfg.source;
  const rule = rules.find((r) => r.enabled && (r.packages ?? []).includes(pkg));
  if (rule) return ruleSource(rule);
  // A source that is off still owns its apps, so its items are counted as skipped rather than unknown.
  return configs.find((c) => c.packages.includes(pkg))?.source ?? null;
}
