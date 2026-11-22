import type { Parsed } from './parsers';

/** What the phone saw recently: enough to tell that an email and a notification describe the same money movement. No text is kept. */
export interface Recent {
  origin: 'notification' | 'import';
  source: Parsed['source'];
  direction: Parsed['direction'];
  amount: number;
  at: number;
}

/** An email can trail the phone alert by minutes. */
export const REPEAT_WINDOW_MS = 10 * 60_000;
const KEEP_MS = 60 * 60_000;
const MAX_RECENT = 100;

/**
 * True when the other kind of capture (a notification for an email, an email for a notification) already saw the same source,
 * direction and amount within ten minutes. It does not matter whether that capture was placed, held or dropped. Same-kind repeats
 * are never matched here, so two real purchases of the same amount are both kept.
 */
export function isRepeat(recent: Recent[], origin: Recent['origin'], p: Parsed, at: number): boolean {
  return recent.some(
    (r) => r.origin !== origin && r.source === p.source && r.direction === p.direction && r.amount === p.amount && Math.abs(r.at - at) <= REPEAT_WINDOW_MS,
  );
}

export function remember(recent: Recent[], origin: Recent['origin'], p: Parsed, at: number, now = Date.now()): Recent[] {
  const fresh = recent.filter((r) => now - r.at <= KEEP_MS);
  fresh.push({ origin, source: p.source, direction: p.direction, amount: p.amount, at });
  return fresh.slice(-MAX_RECENT);
}
