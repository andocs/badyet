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
  /** Bonus money credited straight to the fund. */
  bonus: Money;
  balance: Money;
  /** Part of the credited money that came from the payroll savings plan (the rest of `bonus` is real bonuses). */
  plan: Money;
  /** Everything put into the fund so far (what you had today plus every month's money), ignoring yearly resets, so it only goes up. */
  saved: Money;
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

/** Projection months as plain rows for the screens. A month's saved total = what the pool gave funds plus bonus money. */
export function forecastRows(run: readonly ProjectionMonth[], overrideMonths: ReadonlySet<string>, start: Readonly<Record<string, Money>> = {}, planFundId: string | null = null): ForecastRow[] {
  const credits = fundCredits(run.flatMap((m) => m.bonuses));
  // Running total of what went in, per fund: it never drops when a fund resets.
  const saved: Record<string, number> = { ...start };
  return run.map((m) => {
    // What the payroll savings plan puts in this month (both cutoffs), when it names a fund.
    const planMonth = sum([...m.pay.first.lines, ...m.pay.second.lines].filter((l) => l.source === "savings_plan").map((l) => l.amount));
    return {
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
      m.funds.funds.map((f) => {
        saved[f.fundId] = (saved[f.fundId] ?? 0) + f.amount + f.bonus;
        // The plan's share of what was credited (credits are capped by room, so never more than was credited).
        const plan = f.fundId === planFundId ? money(Math.min(planMonth, f.bonus)) : money(0);
        return [f.fundId, { amount: f.amount, bonus: f.bonus, balance: f.balanceAfter, saved: money(saved[f.fundId]!), plan, reasons: f.reasons }];
      }),
    ),
    };
  });
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
