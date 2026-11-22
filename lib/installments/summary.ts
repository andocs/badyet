import type { IsoDate } from '@/lib/domain/dates';
import { financedAmount, paymentAmounts, schedule } from '@/lib/domain/instalments';
import { money } from '@/lib/domain/money';

export interface PlanFacts {
  price: number;
  downPayment: number;
  termCount: number;
  rateBp: number;
  firstDueOn: string;
}

export interface PlanSummary {
  /** What each regular payment is (the last one can differ by a few centavos). */
  payment: number;
  /** Price less the down payment. */
  financed: number;
  /** Everything paid over the life of the plan, down payment not included. */
  total: number;
  /** What the interest adds. */
  interest: number;
  /** The month of the last payment, YYYY-MM. */
  endsOn: string;
  /** Payments whose due date has come, taken as paid on time. */
  paid: number;
  remaining: number;
  remainingAmount: number;
  nextDue: string | null;
  done: boolean;
}

/** The numbers a plan page shows. "Paid" is worked out from the due dates: every payment due on or before today counts as paid. */
export function summarizePlan(plan: PlanFacts, today: IsoDate): PlanSummary {
  const facts = { price: money(plan.price), downPayment: money(plan.downPayment), termCount: plan.termCount, rateBp: plan.rateBp > 0 ? plan.rateBp : null, firstDueOn: plan.firstDueOn as IsoDate };
  const rows = schedule(facts);
  const amounts = paymentAmounts(facts);
  const total = amounts.reduce((t, a) => t + a, 0);
  const financed = financedAmount(facts);
  const left = rows.filter((r) => r.dueOn > today);
  return {
    payment: amounts[0]!,
    financed,
    total,
    interest: total - financed,
    endsOn: rows[rows.length - 1]!.dueOn.slice(0, 7),
    paid: rows.length - left.length,
    remaining: left.length,
    remainingAmount: left.reduce((t, r) => t + r.amount, 0),
    nextDue: left[0]?.dueOn ?? null,
    done: left.length === 0,
  };
}
