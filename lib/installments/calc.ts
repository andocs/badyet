import type { Cutoff } from "@/lib/budget/validate";
import { isoDate } from "@/lib/domain/dates";
import { financedAmount, remainingPayments, schedule, type InstalmentPlan, type ScheduledPayment } from "@/lib/domain/instalments";
import { money, sum, ZERO, type Money } from "@/lib/domain/money";

export interface InstalmentRow {
  id: string;
  name: string;
  price: Money;
  downPayment: Money;
  termCount: number;
  rateBp: number | null;
  firstDueOn: string; // YYYY-MM-DD
  cutoff: Cutoff;
  walletId: string | null;
}

const planOf = (r: InstalmentRow): InstalmentPlan => ({
  price: r.price,
  downPayment: r.downPayment,
  termCount: r.termCount,
  rateBp: r.rateBp,
  firstDueOn: isoDate(r.firstDueOn),
});

export const paymentsOf = (r: InstalmentRow): ScheduledPayment[] => schedule(planOf(r));

export interface InstalmentSummary {
  financed: Money;
  perPayment: Money;
  total: Money;
  interest: Money;
  remaining: number;
  lastDueOn: string;
}

export function summarize(r: InstalmentRow, today: string): InstalmentSummary {
  const pays = paymentsOf(r);
  const total = sum(pays.map((p) => p.amount));
  const financed = financedAmount(planOf(r));
  return {
    financed,
    perPayment: pays[0].amount,
    total,
    interest: money(total - financed),
    remaining: remainingPayments(pays, isoDate(today)).length,
    lastDueOn: pays[pays.length - 1].dueOn,
  };
}

// What this installment asks for in a given month (YYYY-MM): the payment due that month, or zero.
export function dueInMonth(r: InstalmentRow, month: string): Money {
  const hit = paymentsOf(r).find((p) => p.dueOn.slice(0, 7) === month);
  return hit ? hit.amount : ZERO;
}

export function dueByCutoff(rows: readonly InstalmentRow[], month: string): Record<Cutoff, Money> {
  const total = (cutoff: Cutoff) => sum(rows.filter((r) => r.cutoff === cutoff).map((r) => dueInMonth(r, month)));
  return { first: total("first"), second: total("second") };
}
