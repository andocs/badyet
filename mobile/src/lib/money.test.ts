import { describe, expect, it } from 'vitest';
import { money } from '@/lib/domain/money';
import { MASK, peso } from './money';

describe('peso', () => {
  it('formats centavos with grouping', () => {
    expect(peso(money(123_456), false)).toBe('₱1,234.56');
  });
  it('uses a real minus sign for negatives', () => {
    expect(peso(money(-5_000), false)).toBe('−₱50.00');
  });
  it('masks every figure when amounts are hidden', () => {
    expect(peso(money(123_456), true)).toBe(MASK);
    expect(peso(money(-5), true)).toBe(MASK);
  });
});
