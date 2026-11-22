import { describe, expect, it } from 'vitest';
import { addWord, reorder, ruleTitle, validateDedupe, windowMinutes, windowParts } from './helpers';

describe('validateDedupe', () => {
  it('accepts 1 to 240 whole minutes', () => {
    expect(validateDedupe({ windowMinutes: 1, matchSource: false }).ok).toBe(true);
    expect(validateDedupe({ windowMinutes: 240, matchSource: true }).ok).toBe(true);
  });
  it('rejects out of range and fractions', () => {
    for (const n of [0, 241, 1.5, NaN]) expect(validateDedupe({ windowMinutes: n, matchSource: false }).ok).toBe(false);
  });
});

describe('window units', () => {
  it('splits into hours only when whole', () => {
    expect(windowParts(120)).toEqual({ amount: 2, unit: 'hours' });
    expect(windowParts(90)).toEqual({ amount: 90, unit: 'min' });
    expect(windowMinutes(2, 'hours')).toBe(120);
    expect(windowMinutes(30, 'min')).toBe(30);
  });
});

describe('reorder', () => {
  it('swaps neighbours', () => {
    expect(reorder(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c']);
    expect(reorder(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b']);
  });
  it('returns null at the ends or for unknown ids', () => {
    expect(reorder(['a', 'b'], 'a', 'up')).toBeNull();
    expect(reorder(['a', 'b'], 'b', 'down')).toBeNull();
    expect(reorder(['a'], 'x', 'down')).toBeNull();
  });
});

describe('ruleTitle and addWord', () => {
  it('falls back to the first word', () => {
    expect(ruleTitle({ name: ' Coffee ', words: ['x'], matchText: 'x' })).toBe('Coffee');
    expect(ruleTitle({ name: null, words: ['starbucks'], matchText: 'x' })).toBe('starbucks');
    expect(ruleTitle({ name: '', words: [], matchText: 'promo' })).toBe('promo');
  });
  it('adds unique lower-case words', () => {
    expect(addWord(['a'], '  B  c ')).toEqual(['a', 'b c']);
    expect(addWord(['a'], 'A')).toEqual(['a']);
    expect(addWord(['a'], '  ')).toEqual(['a']);
  });
});
