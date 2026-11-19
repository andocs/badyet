import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ZERO,
  add,
  atLeastZero,
  compare,
  divRound,
  formatPesos,
  fromSheetNumber,
  money,
  mulBp,
  mulRatio,
  neg,
  parsePesos,
  splitLastAbsorbs,
  sub,
  sum,
} from './index';

// Amounts up to about 9 trillion pesos stay inside the safe integer range.
const amount = fc.integer({ min: -9_000_000_000_000, max: 9_000_000_000_000 }).map(money);
const smallAmount = fc.integer({ min: -1_000_000_000, max: 1_000_000_000 }).map(money);

describe('money()', () => {
  it('accepts integers and normalizes -0', () => {
    expect(money(5)).toBe(5);
    expect(Object.is(money(-0), 0)).toBe(true);
  });

  it('rejects fractions, NaN and unsafe integers', () => {
    expect(() => money(1.5)).toThrow(RangeError);
    expect(() => money(Number.NaN)).toThrow(RangeError);
    expect(() => money(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});

describe('0.1 + 0.2 style cases (R-01)', () => {
  it('adds exactly', () => {
    expect(add(money(10), money(20))).toBe(30);
    // The float trap: 0.10 + 0.20 pesos
    expect(formatPesos(add(parsePesos('0.10') ?? ZERO, parsePesos('0.20') ?? ZERO))).toBe('₱0.30');
  });

  it('sums many small amounts without drift', () => {
    const tenCentavos = Array.from({ length: 1000 }, () => money(10));
    expect(sum(tenCentavos)).toBe(10_000);
  });
});

describe('rounding (F.1)', () => {
  it('rounds half away from zero, once', () => {
    expect(divRound(money(5), 2)).toBe(3);
    expect(divRound(money(-5), 2)).toBe(-3);
    expect(divRound(money(4), 3)).toBe(1);
    expect(divRound(money(-4), 3)).toBe(-1);
    expect(divRound(money(7), -2)).toBe(-4);
  });

  it('applies basis points once: PhilHealth 5% of 30,557.50 is 1,527.88 (V-P2)', () => {
    expect(mulBp(parsePesos('30557.50') ?? ZERO, 500)).toBe(152_788);
  });

  it('income tax per cutoff: 89,176.00 / 24 rounds to 3,715.67 (V-P1)', () => {
    expect(divRound(parsePesos('89176') ?? ZERO, 24)).toBe(371_567);
  });

  it('income tax per cutoff: 72,482.18 / 24 rounds to 3,020.09 (V-P2)', () => {
    expect(divRound(parsePesos('72482.18') ?? ZERO, 24)).toBe(302_009);
  });

  it('CIP gross: 688,380.00 x 13.81505% x 125% rounds to 118,875.05 (V-W1)', () => {
    // Rates in basis points lose precision, so the component is a ratio of integers.
    const eligible = parsePesos('688380') ?? ZERO;
    const individual = mulRatio(eligible, 1_381_505, 10_000_000);
    expect(individual).toBe(9_510_004);
    expect(mulRatio(individual, 125, 100)).toBe(11_887_505);
  });

  it('does not overflow Number when multiplying large amounts by basis points', () => {
    const big = money(9_000_000_000_000_000);
    expect(mulBp(big, 10_000)).toBe(big);
    expect(() => mulBp(big, 20_000)).toThrow(RangeError);
  });

  it('rejects division by zero', () => {
    expect(() => divRound(money(1), 0)).toThrow(RangeError);
  });
});

describe('splitLastAbsorbs (F.5)', () => {
  it('12,000.00 over 7 months: 1,714.28 x 6, last 1,714.32 (V-I2)', () => {
    const parts = splitLastAbsorbs(parsePesos('12000') ?? ZERO, 7);
    expect(parts.slice(0, 6).every((p) => p === 171_428)).toBe(true);
    expect(parts[6]).toBe(171_432);
  });

  it('single payment is the whole amount', () => {
    expect(splitLastAbsorbs(money(999), 1)).toEqual([999]);
  });

  it('rejects zero parts', () => {
    expect(() => splitLastAbsorbs(money(1), 0)).toThrow(RangeError);
  });

  it('parts always add up to the total', () => {
    fc.assert(
      fc.property(amount, fc.integer({ min: 1, max: 360 }), (total, n) => {
        const parts = splitLastAbsorbs(total, n);
        expect(parts).toHaveLength(n);
        expect(sum(parts)).toBe(total);
      }),
    );
  });
});

describe('formatPesos / parsePesos', () => {
  it('formats with grouping and two decimals', () => {
    expect(formatPesos(money(123_456))).toBe('₱1,234.56');
    expect(formatPesos(money(5))).toBe('₱0.05');
    expect(formatPesos(money(0))).toBe('₱0.00');
    expect(formatPesos(money(-5))).toBe('-₱0.05');
    expect(formatPesos(money(-123_456), { parentheses: true })).toBe('(₱1,234.56)');
    expect(formatPesos(money(100_000_000), { symbol: false })).toBe('1,000,000.00');
  });

  it('parses typed text', () => {
    expect(parsePesos('1,234.56')).toBe(123_456);
    expect(parsePesos('₱1234')).toBe(123_400);
    expect(parsePesos('-0.5')).toBe(-50);
    expect(parsePesos('-₱0.05')).toBe(-5);
    expect(parsePesos('  7.1 ')).toBe(710);
    expect(parsePesos('.5')).toBeUndefined();
  });

  it('never rounds silently and rejects malformed input', () => {
    expect(parsePesos('1.234')).toBeUndefined();
    expect(parsePesos('1,23.45')).toBeUndefined();
    expect(parsePesos('12abc')).toBeUndefined();
    expect(parsePesos('')).toBeUndefined();
    expect(parsePesos('--5')).toBeUndefined();
    expect(parsePesos('99999999999999999999')).toBeUndefined();
  });

  it('round-trips every amount', () => {
    fc.assert(
      fc.property(amount, (m) => {
        expect(parsePesos(formatPesos(m))).toBe(m);
        expect(parsePesos(formatPesos(m, { symbol: false }))).toBe(m);
      }),
    );
  });
});

describe('fromSheetNumber (import only)', () => {
  it('converts what the cell shows', () => {
    expect(fromSheetNumber(30_557.5)).toBe(3_055_750);
    expect(fromSheetNumber(1527.875)).toBe(152_788);
    expect(fromSheetNumber(1.005)).toBe(101);
    expect(fromSheetNumber(3715.666667)).toBe(371_567);
    expect(fromSheetNumber(-1527.875)).toBe(-152_788);
    expect(fromSheetNumber(0)).toBe(0);
  });

  it('rejects non-finite numbers', () => {
    expect(() => fromSheetNumber(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('arithmetic properties', () => {
  it('add is commutative and associative; sub undoes add', () => {
    fc.assert(
      fc.property(smallAmount, smallAmount, smallAmount, (a, b, c) => {
        expect(add(a, b)).toBe(add(b, a));
        expect(add(add(a, b), c)).toBe(add(a, add(b, c)));
        expect(sub(add(a, b), b)).toBe(a);
        expect(add(a, neg(a))).toBe(ZERO);
      }),
    );
  });

  it('rounding is symmetric around zero', () => {
    fc.assert(
      fc.property(smallAmount, fc.integer({ min: 1, max: 100_000 }), (a, d) => {
        expect(divRound(neg(a), d)).toBe(neg(divRound(a, d)));
      }),
    );
  });

  it('rounding error is at most half a centavo', () => {
    fc.assert(
      fc.property(smallAmount, fc.integer({ min: 1, max: 100_000 }), (a, d) => {
        const rounded = divRound(a, d);
        expect(Math.abs(rounded * d - a) * 2).toBeLessThanOrEqual(d);
      }),
    );
  });

  it('mulBp at 10,000 is the identity and at 0 is zero', () => {
    fc.assert(
      fc.property(amount, (a) => {
        expect(mulBp(a, 10_000)).toBe(a);
        expect(mulBp(a, 0)).toBe(ZERO);
      }),
    );
  });

  it('compare and atLeastZero', () => {
    expect(compare(money(1), money(2))).toBe(-1);
    expect(compare(money(2), money(2))).toBe(0);
    expect(compare(money(3), money(2))).toBe(1);
    expect(atLeastZero(money(-5))).toBe(0);
    expect(atLeastZero(money(5))).toBe(5);
  });
});
