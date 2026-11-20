import type { YearMonth } from "@/lib/domain/dates";
import { addMonths } from "@/lib/domain/dates";
import { sub, type Money } from "@/lib/domain/money";
import { evaluateBudget, type BudgetMonth } from "./budget";
import { fundCredits, planBonuses, type BonusPayment } from "./bonus";
import { allocateFunds, type FundMonth } from "./funds";
import { monthRange } from "./months";
import { buildMonthPay, type MonthPay, type PayslipTemplate } from "./payslip";
import { resolveSalaryTimeline, type MonthSalary } from "./salary";
import type {
  Allowance,
  Assumptions,
  BonusInstance,
  BonusRule,
  BudgetLine,
  Fund,
  MonthOverride,
  PayCutoff,
  PaySettings,
  RaiseAllocation,
  SalaryEvent,
} from "./types";

export interface ProjectionInput {
  start: YearMonth;
  months: number;
  events: readonly SalaryEvent[];
  allowances: readonly Allowance[];
  assumptions: Assumptions;
  settings: PaySettings;
  templates?: readonly PayslipTemplate[];
  bonusRules: readonly BonusRule[];
  bonusInstances: readonly BonusInstance[];
  lines: readonly BudgetLine[];
  allocations?: readonly RaiseAllocation[];
  funds: readonly Fund[];
  /** Start balance per fund id (see startBalances in funds.ts). */
  fundStart: Readonly<Record<string, Money>>;
  overrides?: readonly MonthOverride[];
  tightBelow?: Money;
}

export interface ProjectionMonth {
  month: YearMonth;
  salary: MonthSalary;
  /** Payslips with bonuses landing this month. */
  pay: MonthPay;
  bonuses: BonusPayment[];
  /** The budget works on regular take-home; bonuses are placed by their own splits. */
  budget: BudgetMonth;
  funds: FundMonth;
  expected: boolean;
  assumed: boolean;
}

/**
 * The whole chain for a run of months: salary timeline, payslips, bonuses, budget, fund allocation. Pure and deterministic.
 * includeExpected false is the "without expected raises" view: expected events, allowances tied to them and their raise
 * top-ups are dropped.
 */
export function runProjection(input: ProjectionInput, opts: { includeExpected: boolean }): ProjectionMonth[] {
  const months = monthRange(input.start, input.months);
  const cache = new Map<YearMonth, MonthSalary>();
  const salaryOf = (m: YearMonth): MonthSalary => {
    let s = cache.get(m);
    if (!s) {
      s = resolveSalaryTimeline(input.events, input.allowances, input.assumptions, [m], opts)[0]!;
      cache.set(m, s);
    }
    return s;
  };
  const templates = input.templates ?? [];
  const regularPay = (m: YearMonth): MonthPay => buildMonthPay(salaryOf(m), input.settings, [], templates);

  const bonuses = planBonuses(input.bonusRules, input.bonusInstances, salaryOf, input.settings, input.assumptions, months);
  const included = input.events.filter((e) => opts.includeExpected || e.status === "confirmed");
  const allocations = (input.allocations ?? []).filter((a) => included.some((e) => e.id === a.salaryEventId));
  const raiseExtras: Record<string, Record<PayCutoff, Money>> = {};
  for (const a of allocations) {
    const e = included.find((x) => x.id === a.salaryEventId)!;
    if (raiseExtras[e.id]) continue;
    const after = regularPay(e.effectiveMonth);
    const before = regularPay(addMonths(e.effectiveMonth, -1));
    raiseExtras[e.id] = { first: sub(after.first.takeHome, before.first.takeHome), second: sub(after.second.takeHome, before.second.takeHome) };
  }

  const budgets = months.map((m) => {
    const pay = regularPay(m);
    return evaluateBudget({
      month: m,
      takeHome: { first: pay.first.takeHome, second: pay.second.takeHome },
      lines: input.lines,
      allocations,
      events: included,
      raiseExtras,
      tightBelow: input.tightBelow,
    });
  });

  const credits = fundCredits(bonuses);
  const fundMonths = allocateFunds(
    input.funds,
    input.fundStart,
    months.map((m, i) => ({ month: m, pool: budgets[i]!.savingsPool, bonusCredits: credits.get(m) })),
    input.overrides ?? [],
  );

  return months.map((m, i) => {
    const salary = salaryOf(m);
    return {
      month: m,
      salary,
      pay: buildMonthPay(salary, input.settings, bonuses.filter((b) => b.month === m), templates),
      bonuses: bonuses.filter((b) => b.month === m),
      budget: budgets[i]!,
      funds: fundMonths[i]!,
      expected: salary.expected,
      assumed: salary.assumed,
    };
  });
}

export interface ExpectedComparison {
  with: ProjectionMonth[];
  without: ProjectionMonth[];
  /** Per month: what the expected raises add (with minus without). */
  difference: { month: YearMonth; takeHome: Money; savingsPool: Money }[];
}

/** Run the projection with and without expected raises, for the Forecast compare switch and Budget's "without expected raises" view. */
export function runWithAndWithoutExpected(input: ProjectionInput): ExpectedComparison {
  const withExpected = runProjection(input, { includeExpected: true });
  const withoutExpected = runProjection(input, { includeExpected: false });
  return {
    with: withExpected,
    without: withoutExpected,
    difference: withExpected.map((m, i) => ({
      month: m.month,
      takeHome: sub(m.pay.takeHome, withoutExpected[i]!.pay.takeHome),
      savingsPool: sub(m.budget.savingsPool, withoutExpected[i]!.budget.savingsPool),
    })),
  };
}
