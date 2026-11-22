import { describe, expect, it } from 'vitest';
import type { Parsed } from './parsers';
import { isRepeat, remember, REPEAT_WINDOW_MS } from './recent';

const P: Parsed = { source: 'bpi', direction: 'out', amount: 5_000, counterparty: null, counterpartyLast4: null, accountHint: null, ref: null, accountName: null } as Parsed;
const T = 1_000_000_000;

describe('recent captures', () => {
  it('matches the other kind of capture for the same source, direction and amount within ten minutes', () => {
    const r = remember([], 'notification', P, T);
    expect(isRepeat(r, 'import', P, T + 4 * 60_000)).toBe(true);
    expect(isRepeat(r, 'import', P, T + REPEAT_WINDOW_MS + 1)).toBe(false);
  });

  it('never matches the same kind, another source, direction or amount', () => {
    const r = remember([], 'notification', P, T);
    expect(isRepeat(r, 'notification', P, T)).toBe(false);
    expect(isRepeat(r, 'import', { ...P, source: 'gcash' }, T)).toBe(false);
    expect(isRepeat(r, 'import', { ...P, direction: 'in' }, T)).toBe(false);
    expect(isRepeat(r, 'import', { ...P, amount: 6_000 }, T)).toBe(false);
  });

  it('forgets entries older than an hour', () => {
    const r = remember(remember([], 'notification', P, T, T), 'import', P, T + 2 * 3_600_000, T + 2 * 3_600_000);
    expect(r).toHaveLength(1);
  });
});
