import { decide, type Decision } from '@/lib/capture/decide';
import { canParse, matchText, parseNotification, type Parsed } from '@/lib/capture/parsers';
import { buildRow, dedupeKey, resolveAccount, type AccountLite, type TxnInsert } from '@/lib/capture/row';
import type { CapturePattern } from '@/lib/capture/patterns';
import { isRepeat, remember, type Recent } from '@/lib/capture/recent';
import type { CaptureRule, SourceConfig, SourceKey } from '@/lib/capture/sources';

/** One notification as the Android listener queued it. */
export interface CapturedNotification {
  package: string;
  title: string | null;
  text: string | null;
  bigText: string | null;
  postTime: number;
}

/** A capture that is understood and kept, but whose account is not known yet. Holds no raw notification text. */
export interface Held {
  parsed: Parsed;
  postTime: number;
  decision: Extract<Decision, { keep: true }>;
  hash: string;
  /** Where it came from: a phone notification (default) or an email. */
  origin?: 'notification' | 'import';
}

export interface RunContext {
  configs: SourceConfig[];
  rules: CaptureRule[];
  /** Your own notification patterns. */
  patterns?: CapturePattern[];
  accounts: AccountLite[];
}

export interface RunDeps {
  /** Your settings, accounts and rules, or null when they cannot be loaded and nothing is remembered. */
  loadContext: () => Promise<RunContext | null>;
  /** Everything the listener queued since the last call; this empties the queue. */
  drain: () => CapturedNotification[];
  readHeld: () => Held[];
  writeHeld: (held: Held[]) => void;
  /** Puts a row in the send queue. */
  enqueue: (row: TxnInsert) => Promise<void>;
  hash: (text: string) => Promise<string>;
  newId: () => string;
  /** True when the same money movement is already recorded (for example the same transfer seen in a notification and an email). */
  isDuplicate?: (row: TxnInsert) => Promise<boolean>;
  /** What notifications and emails saw recently, so an alert is not added when its email came first. */
  readRecent?: () => Recent[];
  writeRecent?: (recent: Recent[]) => void;
}

export interface RunSummary {
  /** Rows queued to send. */
  added: number;
  /** Understood and kept, but waiting for an account. */
  held: number;
  /** Dropped by your settings or rules, or a repeat. */
  skipped: number;
  /** Not a money movement, or from an app with no parser. */
  ignored: number;
}

const MAX_HELD = 200;

/**
 * Turns queued notifications into rows. Safe by design: if your settings cannot be read the queue is left alone, so nothing
 * is lost; a capture whose account is unknown is held (without its text) until you choose an account; a repeat is dropped.
 */
export async function runCapture(d: RunDeps): Promise<RunSummary> {
  const ctx = await d.loadContext();
  if (!ctx) return { added: 0, held: d.readHeld().length, skipped: 0, ignored: 0 };

  const sum: RunSummary = { added: 0, held: 0, skipped: 0, ignored: 0 };
  const seen = new Set<string>();
  let recent = d.readRecent?.() ?? [];
  const cfgOf = (s: SourceKey) => ctx.configs.find((c) => c.source === s);
  const place = async (h: Held): Promise<boolean> => {
    const cfg = cfgOf(h.parsed.source);
    const accountId = cfg ? resolveAccount(cfg, h.parsed, ctx.accounts) : null;
    if (!accountId) return false;
    const row = buildRow({ id: d.newId(), parsed: h.parsed, decision: h.decision, accountId, postTime: h.postTime, hash: h.hash, source: h.origin });
    // Emails usually arrive after the phone alert for the same event. Only emails are checked, so two real purchases of the same amount in a row are both kept.
    if (h.origin === 'import' && d.isDuplicate && (await d.isDuplicate(row))) {
      sum.skipped += 1;
      return true;
    }
    await d.enqueue(row);
    sum.added += 1;
    return true;
  };

  // Earlier captures that were waiting for an account may be placeable now.
  const stillHeld: Held[] = [];
  for (const h of d.readHeld()) {
    seen.add(h.hash);
    if (!(await place(h))) stillHeld.push(h);
  }

  const bySource = new Map<string, SourceKey>();
  for (const c of ctx.configs) for (const p of c.packages) bySource.set(p, c.source);

  for (const n of d.drain()) {
    const source = bySource.get(n.package);
    const cfg = source ? cfgOf(source) : undefined;
    if (!source || !cfg || !canParse(source, ctx.patterns)) {
      sum.ignored += 1;
      continue;
    }
    const parsed = parseNotification(source, n, ctx.patterns);
    if (!parsed) {
      sum.ignored += 1;
      continue;
    }
    const decision = decide({ source, amount: parsed.amount, direction: parsed.direction, text: matchText(n) }, cfg, ctx.rules);
    if (!decision.keep) {
      sum.skipped += 1;
      continue;
    }
    const hash = await d.hash(dedupeKey(parsed, n.postTime));
    if (seen.has(hash)) {
      sum.skipped += 1;
      continue;
    }
    // An email already described this movement (placed, held or dropped), so this alert adds nothing.
    if (isRepeat(recent, 'notification', parsed, n.postTime)) {
      sum.skipped += 1;
      continue;
    }
    seen.add(hash);
    recent = remember(recent, 'notification', parsed, n.postTime);
    const held: Held = { parsed, postTime: n.postTime, decision, hash };
    if (!(await place(held))) stillHeld.push(held);
  }

  d.writeRecent?.(recent);
  const kept = stillHeld.slice(-MAX_HELD);
  d.writeHeld(kept);
  sum.held = kept.length;
  return sum;
}
