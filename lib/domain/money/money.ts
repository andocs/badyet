/**
 * Money is an integer count of centavos (planning doc, F.1).
 *
 * Rules:
 * - Never a float. Every function returns a safe integer or throws.
 * - Rates are applied once per line and rounded once, half away from zero
 *   (identical to half-up for the positive amounts that dominate this app).
 * - Intermediate products use BigInt, so large amounts times basis points cannot
 *   lose precision.
 */

declare const moneyBrand: unique symbol;

/** An integer number of centavos. Create with {@link money} or the parsers. */
export type Money = number & { readonly [moneyBrand]: 'Money' };

export const ZERO = 0 as Money;

/** Wrap an integer number of centavos. Throws if it is not a safe integer. */
export function money(centavos: number): Money {
  if (!Number.isSafeInteger(centavos)) {
    throw new RangeError(`Money must be a safe integer number of centavos, got ${String(centavos)}`);
  }
  // `+ 0` turns -0 into 0.
  return (centavos + 0) as Money;
}

function fromBigInt(value: bigint): Money {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) {
    throw new RangeError('Money result is outside the safe integer range');
  }
  return (n + 0) as Money;
}

/** Divide two BigInts and round half away from zero. The denominator must not be zero. */
function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new RangeError('Division by zero');
  }
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const quotient = n / d;
  const remainder = n % d;
  const rounded = remainder * 2n >= d ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

function assertInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a safe integer, got ${String(value)}`);
  }
}

export function add(a: Money, b: Money): Money {
  return money(a + b);
}

export function sub(a: Money, b: Money): Money {
  return money(a - b);
}

export function neg(a: Money): Money {
  return money(0 - a);
}

export function abs(a: Money): Money {
  return money(Math.abs(a));
}

export function sum(values: readonly Money[]): Money {
  let total = 0n;
  for (const v of values) {
    total += BigInt(v);
  }
  return fromBigInt(total);
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function min(a: Money, b: Money): Money {
  return a <= b ? a : b;
}

export function max(a: Money, b: Money): Money {
  return a >= b ? a : b;
}

/** Clamp below at zero. */
export function atLeastZero(a: Money): Money {
  return a < 0 ? ZERO : a;
}

/** Round numerator/denominator once, half away from zero. For rules that need a single rounding. */
export function fromRatio(numerator: bigint, denominator: bigint): Money {
  return fromBigInt(roundDiv(numerator, denominator));
}

/** Multiply by a rate in basis points (2000 = 20.00%), rounded once. */
export function mulBp(amount: Money, basisPoints: number): Money {
  assertInteger(basisPoints, 'basisPoints');
  return fromBigInt(roundDiv(BigInt(amount) * BigInt(basisPoints), 10000n));
}

/** Multiply by an integer ratio numerator/denominator, rounded once. */
export function mulRatio(amount: Money, numerator: number, denominator: number): Money {
  assertInteger(numerator, 'numerator');
  assertInteger(denominator, 'denominator');
  return fromBigInt(roundDiv(BigInt(amount) * BigInt(numerator), BigInt(denominator)));
}

/** Divide by an integer, rounded half away from zero. */
export function divRound(amount: Money, divisor: number): Money {
  assertInteger(divisor, 'divisor');
  return fromBigInt(roundDiv(BigInt(amount), BigInt(divisor)));
}

/**
 * Split a total into `parts` payments. The first parts - 1 payments are
 * the total divided by parts, truncated toward zero; the last payment absorbs the remainder
 * (planning doc, F.5), so the parts always add up to the total.
 */
export function splitLastAbsorbs(total: Money, parts: number): Money[] {
  assertInteger(parts, 'parts');
  if (parts < 1) {
    throw new RangeError('parts must be at least 1');
  }
  const each = money(Math.trunc(total / parts));
  const result: Money[] = [];
  let allocated = ZERO;
  for (let i = 0; i < parts - 1; i += 1) {
    result.push(each);
    allocated = add(allocated, each);
  }
  result.push(sub(total, allocated));
  return result;
}

/** Digits of a non-negative safe integer, grouped by thousands. */
function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export interface FormatOptions {
  /** Prefix with the peso sign. Default true. */
  readonly symbol?: boolean;
  /** Show negatives as (1,234.56) instead of -1,234.56. Default false. */
  readonly parentheses?: boolean;
}

/** Format as pesos with two decimals, for example `₱1,234.56` or `-₱0.05`. */
export function formatPesos(amount: Money, options: FormatOptions = {}): string {
  const { symbol = true, parentheses = false } = options;
  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const pesos = Math.trunc(absolute / 100);
  const cents = absolute % 100;
  const body = `${group(String(pesos))}.${String(cents).padStart(2, '0')}`;
  const text = `${symbol ? '₱' : ''}${body}`;
  if (!negative) {
    return text;
  }
  return parentheses ? `(${text})` : `-${text}`;
}

const PESO_PATTERN = /^(-?)₱?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

/**
 * Parse typed or copied peso text such as `1,234.56`, `₱1234`, `-0.5`.
 * Accepts at most two decimals (it never rounds silently). Returns undefined for anything else.
 */
export function parsePesos(text: string): Money | undefined {
  const trimmed = text.trim().replace(/^₱\s*/, '').replace(/^(-)\s*₱\s*/, '$1');
  const match = PESO_PATTERN.exec(trimmed);
  if (!match) {
    return undefined;
  }
  const [, sign, whole, fraction = ''] = match;
  if (whole === undefined) {
    return undefined;
  }
  const centavos = Number(whole.replace(/,/g, '')) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(centavos)) {
    return undefined;
  }
  return money(sign === '-' ? -centavos : centavos);
}

/**
 * Convert a number read from the spreadsheet to centavos. Import and test fixtures only: the
 * sheet stores floats. The number is read as the shortest decimal text (what you see in the
 * cell), then rounded half away from zero at the third decimal, so 1527.875 becomes 152788 and
 * 1.005 becomes 101.
 */
export function fromSheetNumber(value: number): Money {
  if (!Number.isFinite(value)) {
    throw new RangeError('Sheet number must be finite');
  }
  let text = String(Math.abs(value));
  if (/e/i.test(text)) {
    text = Math.abs(value).toFixed(10);
  }
  const [wholeText = '0', fractionText = ''] = text.split('.');
  const padded = fractionText.padEnd(3, '0');
  const centavos =
    BigInt(wholeText) * 100n + BigInt(padded.slice(0, 2)) + (padded.charCodeAt(2) >= 53 ? 1n : 0n);
  return fromBigInt(value < 0 ? -centavos : centavos);
}
