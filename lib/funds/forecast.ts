import type { YearMonth } from "@/lib/domain/dates";
import { monthParts } from "@/lib/domain/dates";
import { money, sum, type Money } from "@/lib/domain/money";
import { fundCredits } from "@/lib/engine/bonus";
import type { ProjectionInput, ProjectionMonth } from "@/lib/engine/projection";
import type { FundsData } from "./load";
import { savingsByMonth } from "@/lib/budget/savings";

/** The whole projection input for the forecast: salary, bonuses, budget lines, funds and overrides. */
export function forecastInput(d: FundsData, start: YearMonth, months = 60): ProjectionInput {
  return {
    start,
    months,
    ...d.budget.salary.input,
    lines: d.budget.lines,
    plans: d.budget.plans,
    extraSavings: savingsByMonth(d.budget.pools, d.budget.paydays),
    allocations: d.budget.allocations,
    funds: d.funds,
    fundStart: d.fundStart,
    overrides: d.overrides,
  };
}

export interface FundCell {
  /** Taken from the month's pool. */
  amount: Money;
  /** Money credited straight to the fund, not taken from the pool: bonuses and the payroll savings plan. */
  bonus: Money;
  balance: Money;
  /** Part of the credited money that came from the payroll savings plan (the rest of `bonus` is real bonuses). */
  plan: Money;
  reasons: string[];
}

export interface ForecastRow {
  month: YearMonth;
  year: number;
  assumed: boolean;
  expected: boolean;
  override: boolean;
  take: Money;
  pool: Money;
  unplaced: Money;
  /** Bonuses landing this month. */
  bonuses: { name: string; net: Money }[];
  /** Left after every budget line is below this: the month is tight. */
  tight: boolean;
  /** Net bonus money assigned to funds this month, before room caps. */
  bonusCredits: Record<string, Money>;
  funds: Record<string, FundCell>;
}

/** Projection months as plain rows for the screens. A month's saved total = what the pool gave funds plus money credited straight to them. */
export function forecastRows(run: readonly ProjectionMonth[], overrideMonths: ReadonlySet<string>): ForecastRow[] {
  const credits = fundCredits(run.flatMap((m) => m.bonuses));
  return run.map((m) => ({
    month: m.month,
    year: monthParts(m.month).year,
    assumed: m.assumed,
    expected: m.expected,
    override: overrideMonths.has(m.month),
    take: m.pay.takeHome,
    pool: m.budget.savingsPool,
    unplaced: m.funds.unplaced,
    bonuses: m.bonuses.map((b) => ({ name: b.name, net: b.net })),
    tight: m.budget.tight.first || m.budget.tight.second || m.budget.over.first || m.budget.over.second,
    bonusCredits: credits.get(m.month) ?? {},
    funds: Object.fromEntries(
      m.funds.funds.map((f) => [f.fundId, { amount: f.amount, bonus: money(f.bonus + f.plan), plan: f.plan, balance: f.balanceAfter, reasons: f.reasons }]),
    ),
  }));
}

export const totalBalance = (row: ForecastRow): Money => sum(Object.values(row.funds).map((f) => f.balance));
export const savedThisMonth = (row: ForecastRow, fundId?: string): Money =>
  fundId ? money((row.funds[fundId]?.amount ?? 0) + (row.funds[fundId]?.bonus ?? 0)) : sum(Object.values(row.funds).map((f) => money(f.amount + f.bonus)));

/** The last month of each year in the run, for the year ladder. */
export function yearEnds(rows: readonly ForecastRow[]): ForecastRow[] {
  const out = new Map<number, ForecastRow>();
  for (const r of rows) out.set(r.year, r);
  return [...out.values()];
}
