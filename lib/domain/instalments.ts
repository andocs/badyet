import type { IsoDate } from './dates';
import { addMonthsClamped } from './dates';
import type { Money } from './money';
import { ZERO, money, splitLastAbsorbs, sub } from './money';

/** Instalment schedule rules (planning doc, F.5). */

export interface InstalmentPlan {
  readonly price: Money;
  readonly downPayment?: Money;
  /** Number of payments, at least 1. */
  readonly termCount: number;
  /** Annual percentage rate in basis points; null or 0 means no interest. */
  readonly rateBp: number | null;
  /** Due date of payment 1; null means the plan is only planned. */
  readonly firstDueOn: IsoDate | null;
}

export interface ScheduledPayment {
  readonly seq: number;
  readonly dueOn: IsoDate;
  readonly amount: Money;
}

export function financedAmount(plan: InstalmentPlan): Money {
  return sub(plan.price, plan.downPayment ?? ZERO);
}

/**
 * Payment amounts. Payments 1 to n-1 are equal; the last payment absorbs the rounding so the
 * total is exact. With interest, the level payment is computed in double precision and rounded
 * to the centavo; the error is far below half a centavo for any realistic amount.
 */
export function paymentAmounts(plan: InstalmentPlan): Money[] {
  const n = plan.termCount;
  if (!Number.isSafeInteger(n) || n < 1) {
    throw new RangeError('termCount must be a whole number of at least 1');
  }
  const financed = financedAmount(plan);
  if (financed <= 0) {
    throw new RangeError('Financed amount must be above zero');
  }
  if (plan.rateBp === null || plan.rateBp <= 0) {
    return splitLastAbsorbs(financed, n);
  }
  const r = plan.rateBp / 10_000 / 12;
  const level = (financed * r) / (1 - Math.pow(1 + r, -n));
  const each = money(Math.round(level));
  const total = money(Math.round(level * n));
  const payments: Money[] = [];
  let allocated = ZERO;
  for (let i = 0; i < n - 1; i += 1) {
    payments.push(each);
    allocated = money(allocated + each);
  }
  payments.push(sub(total, allocated));
  return payments;
}

/** The stored schedule. A planned plan (no first due date) has no schedule. */
export function schedule(plan: InstalmentPlan): ScheduledPayment[] {
  if (plan.firstDueOn === null) {
    return [];
  }
  const first = plan.firstDueOn;
  return paymentAmounts(plan).map((amount, index) => ({
    seq: index + 1,
    dueOn: addMonthsClamped(first, index),
    amount,
  }));
}

/** Payments due on or after asOf that are not marked paid. */
export function remainingPayments(
  payments: readonly ScheduledPayment[],
  asOf: IsoDate,
  paidSeqs: ReadonlySet<number> = new Set(),
): ScheduledPayment[] {
  return payments.filter((p) => p.dueOn >= asOf && !paidSeqs.has(p.seq));
}
