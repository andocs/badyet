import type { Parsed } from './parsers';

/** What the phone saw recently: enough to tell that an email and a notification describe the same money movement. No text is kept. */
export interface Recent {
  origin: 'notification' | 'import';
  source: Parsed['source'];
  direction: Parsed['direction'];
  amount: number;
  at: number;
}

/** The duplicate rule. Stored per user in dedupe_rules (rev-29); these are the defaults when no row exists. */
export interface DedupeRule {
  windowMin: number;
  /** True: the source (bank or wallet) must match too. False: amount and direction are enough, whichever app reported it. */
  matchSource: boolean;
}

export const DEFAULT_DEDUPE: DedupeRule = { windowMin: 30, matchSource: false };

/** An email can trail the phone alert by many minutes. */
export const REPEAT_WINDOW_MS = DEFAULT_DEDUPE.windowMin * 60_000;
const KEEP_MS = 60 * 60_000;
const MAX_RECENT = 100;

/**
 * True when the other kind of capture (a notification for an email, an email for a notification) already saw the same direction and
 * amount (and the same source, if the rule asks) within the rule's window, 30 minutes by default. It does not matter whether that capture was placed, held or dropped. Same-kind repeats
 * are never matched here, so two real purchases of the same amount are both kept.
 */
export function isRepeat(recent: Recent[], origin: Recent['origin'], p: Parsed, at: number, rule: DedupeRule = DEFAULT_DEDUPE): boolean {
  const windowMs = rule.windowMin * 60_000;
  return recent.some(
    (r) => r.origin !== origin && (!rule.matchSource || r.source === p.source) && r.direction === p.direction && r.amount === p.amount && Math.abs(r.at - at) <= windowMs,
  );
}

export function remember(recent: Recent[], origin: Recent['origin'], p: Parsed, at: number, now = Date.now()): Recent[] {
  const fresh = recent.filter((r) => now - r.at <= KEEP_MS);
  fresh.push({ origin, source: p.source, direction: p.direction, amount: p.amount, at });
  return fresh.slice(-MAX_RECENT);
}
