export const SOURCES = ['gcash', 'maya', 'bpi', 'gotyme', 'maribank', 'grab', 'foodpanda', 'gwallet', 'custom'] as const;
export type SourceKey = (typeof SOURCES)[number];

export const isSource = (v: unknown): v is SourceKey => typeof v === 'string' && (SOURCES as readonly string[]).includes(v);

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
});

export type RuleAction = 'ignore' | 'set_category' | 'auto_confirm';
export const RULE_ACTIONS: readonly RuleAction[] = ['ignore', 'set_category', 'auto_confirm'];

export const ACTION_LABEL: Record<RuleAction, string> = {
  ignore: 'Ignore it',
  set_category: 'Put it under a category',
  auto_confirm: 'Confirm it without asking',
};

/** A keyword rule: when a notification or email contains `matchText`, do `action`. */
export interface CaptureRule {
  id: string;
  /** null = every source. */
  source: SourceKey | null;
  matchText: string;
  action: RuleAction;
  categoryId: string | null;
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
}
export interface RuleRow { id: string; source: string | null; match_text: string; action: string; category_id: string | null }

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
    };
  });
}

export function rulesFromRows(rows: readonly RuleRow[]): CaptureRule[] {
  return rows
    .filter((r) => (r.source === null || isSource(r.source)) && (RULE_ACTIONS as readonly string[]).includes(r.action))
    .map((r) => ({ id: r.id, source: r.source as SourceKey | null, matchText: r.match_text, action: r.action as RuleAction, categoryId: r.category_id }));
}

/** Android app ids to listen to: every enabled source's apps. */
export const allowedPackages = (configs: readonly SourceConfig[]): string[] => [
  ...new Set(configs.filter((c) => c.enabled).flatMap((c) => c.packages)),
];
