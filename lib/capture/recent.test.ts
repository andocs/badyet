import { describe, expect, it } from 'vitest';
import type { Parsed } from './parsers';
import { isRepeat, remember, REPEAT_WINDOW_MS } from './recent';

const P: Parsed = { source: 'bpi', direction: 'out', amount: 5_000, counterparty: null, counterpartyLast4: null, accountHint: null, ref: null, accountName: null } as Parsed;
const T = 1_000_000_000;

describe('recent captures', () => {
  it('matches the other kind of capture for the same direction and amount within thirty minutes', () => {
    const r = remember([], 'notification', P, T);
    expect(isRepeat(r, 'import', P, T + 4 * 60_000)).toBe(true);
    expect(isRepeat(r, 'import', P, T + REPEAT_WINDOW_MS + 1)).toBe(false);
  });

  it('matches across sources by default, and only the same source when the rule says so', () => {
    const r = remember([], 'notification', P, T);
    expect(isRepeat(r, 'import', { ...P, source: 'gcash' }, T)).toBe(true);
    expect(isRepeat(r, 'import', { ...P, source: 'gcash' }, T, { windowMin: 30, matchSource: true })).toBe(false);
    expect(isRepeat(r, 'import', P, T, { windowMin: 30, matchSource: true })).toBe(true);
  });

  it('uses the rule window', () => {
    const r = remember([], 'notification', P, T);
    expect(isRepeat(r, 'import', P, T + 20 * 60_000, { windowMin: 10, matchSource: false })).toBe(false);
    expect(isRepeat(r, 'import', P, T + 20 * 60_000, { windowMin: 30, matchSource: false })).toBe(true);
  });

  it('never matches the same kind, another direction or amount', () => {
    const r = remember([], 'notification', P, T);
    expect(isRepeat(r, 'notification', P, T)).toBe(false);
    expect(isRepeat(r, 'import', { ...P, direction: 'in' }, T)).toBe(false);
    expect(isRepeat(r, 'import', { ...P, amount: 6_000 }, T)).toBe(false);
  });

  it('forgets entries older than an hour', () => {
    const r = remember(remember([], 'notification', P, T, T), 'import', P, T + 2 * 3_600_000, T + 2 * 3_600_000);
    expect(r).toHaveLength(1);
  });
});
