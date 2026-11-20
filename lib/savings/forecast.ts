import type { ForecastMonth, GoalId, MonthResult } from "@/lib/domain/allocator";
import { allocateForecast } from "@/lib/domain/allocator";
import { yearMonth } from "@/lib/domain/dates";
import { add, ZERO, type Money } from "@/lib/domain/money";
import { shiftMonth } from "@/lib/transfer/month";
import type { SavingsInput } from "./input";

export interface ForecastInputs {
  savings: SavingsInput;
  /** Savings set aside every month (both cutoffs of the Savings budget lines). */
  monthlyPool: Money;
  /** CIP net by month (YYYY-MM): added to that month's pool, which is the "CIP month". */
  cipByMonth: Readonly<Record<string, Money>>;
  overrides: Readonly<Record<string, GoalId>>;
  months?: number;
}

export function buildMonths(i: ForecastInputs): ForecastMonth[] {
  const count = i.months ?? 12;
  return Array.from({ length: count }, (_, k) => {
    const m = shiftMonth(i.savings.startMonth, k);
    const cip = i.cipByMonth[m];
    const override = i.overrides[m];
    return {
      month: yearMonth(m),
      pool: cip !== undefined ? add(i.monthlyPool, cip) : i.monthlyPool,
      ...(override !== undefined ? { override } : {}),
      ...(cip !== undefined ? { cip: true } : {}),
    };
  });
}

export function runForecast(i: ForecastInputs): MonthResult[] {
  return allocateForecast(i.savings.start, buildMonths(i), i.savings.settings);
}

export { ZERO };
