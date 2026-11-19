import { describe, expect, it } from 'vitest';
import {
  addMonths,
  addMonthsClamped,
  isoDate,
  monthsBetween,
  periodOf,
  yearMonth,
} from './dates';

describe('dates', () => {
  it('rejects impossible dates', () => {
    expect(() => isoDate('2026-02-30')).toThrow(RangeError);
    expect(() => isoDate('2026-13-01')).toThrow(RangeError);
    expect(() => isoDate('26-01-01')).toThrow(RangeError);
    expect(isoDate('2028-02-29')).toBe('2028-02-29');
  });

  it('adds months across years and clamps the day', () => {
    expect(addMonths(yearMonth('2026-11'), 2)).toBe('2027-01');
    expect(addMonths(yearMonth('2026-01'), -1)).toBe('2025-12');
    expect(addMonthsClamped(isoDate('2027-01-31'), 1)).toBe('2027-02-28');
    expect(addMonthsClamped(isoDate('2028-01-31'), 1)).toBe('2028-02-29');
    expect(monthsBetween(yearMonth('2026-10'), yearMonth('2027-03'))).toBe(5);
  });

  it('assigns cutoff periods: 11-24 is period 1, 25-10 is period 2 (F.1)', () => {
    expect(periodOf(isoDate('2026-10-11')).id).toBe('2026-10-1');
    expect(periodOf(isoDate('2026-10-24')).id).toBe('2026-10-1');
    expect(periodOf(isoDate('2026-10-25')).id).toBe('2026-10-2');
    const p = periodOf(isoDate('2026-11-10'));
    expect(p.id).toBe('2026-10-2');
    expect(p.start).toBe('2026-10-25');
    expect(p.end).toBe('2026-11-10');
    expect(periodOf(isoDate('2027-01-05')).id).toBe('2026-12-2');
  });
});
