import type { YearMonth } from "@/lib/domain/dates";
import { addMonths, monthParts } from "@/lib/domain/dates";
import { sub, sum, ZERO, type Money } from "@/lib/domain/money";
import { planBonuses, type BonusPayment } from "@/lib/engine/bonus";
import { monthRange } from "@/lib/engine/months";
import { buildMonthPay, type MonthPay, type PayslipTemplate } from "@/lib/engine/payslip";
import { resolveSalaryTimeline, type MonthSalary } from "@/lib/engine/salary";
import type { Allowance, Assumptions, BonusInstance, BonusRule, PaySettings, SalaryEvent } from "@/lib/engine/types";

/** Everything the salary screens compute from. All of it is plain data, so it can run on the server or in the browser. */
export interface SalaryInput {
  events: readonly SalaryEvent[];
  allowances: readonly Allowance[];
  assumptions: Assumptions;
  settings: PaySettings;
  templates: readonly PayslipTemplate[];
  bonusRules: readonly BonusRule[];
  bonusInstances: readonly BonusInstance[];
}

export interface RegularMonth {
  month: YearMonth;
  salary: MonthSalary;
  /** Regular pay only: no bonuses. */
  pay: MonthPay;
}

export function salaryAt(input: SalaryInput, month: YearMonth, includeExpected = true): MonthSalary {
  return resolveSalaryTimeline(input.events, input.allowances, input.assumptions, [month], { includeExpected })[0]!;
}

/** Regular pay (no bonuses) for a run of months, for the chart and the year table. */
export function regularRange(input: SalaryInput, start: YearMonth, count: number, includeExpected = true): RegularMonth[] {
  return monthRange(start, count).map((month) => {
    const salary = salaryAt(input, month, includeExpected);
    return { month, salary, pay: buildMonthPay(salary, input.settings, [], input.templates) };
  });
}

export interface EventRow {
  event: SalaryEvent;
  /** Change in monthly take-home from the month before the event; null for the start event and one-offs. */
  delta: Money | null;
}

/** Each event with its effect on monthly take-home (regular pay, expected events counted). */
export function eventRows(input: SalaryInput): EventRow[] {
  return [...input.events]
    .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth) || a.id.localeCompare(b.id))
    .map((event) => {
      if (event.kind === "start" || event.kind === "adjustment") return { event, delta: null };
      const after = buildMonthPay(salaryAt(input, event.effectiveMonth), input.settings, [], input.templates).takeHome;
      const before = buildMonthPay(salaryAt(input, addMonths(event.effectiveMonth, -1)), input.settings, [], input.templates).takeHome;
      return { event, delta: sub(after, before) };
    });
}

export interface YearRow {
  year: number;
  /** December of the year. */
  base: Money;
  allowances: Money;
  contributions: Money;
  tax: Money;
  first: Money;
  second: Money;
  /** Bonuses paid that year, after tax. */
  bonusNet: Money;
  assumed: boolean;
}

/** One row a year, from December's regular payslip (the year's last month), plus the bonuses paid that year. */
export function yearRows(input: SalaryInput, years: readonly number[]): YearRow[] {
  return years.map((year) => {
    const dec = `${year}-12` as YearMonth;
    const salary = salaryAt(input, dec);
    const pay = buildMonthPay(salary, input.settings, [], input.templates);
    const months = monthRange(`${year}-01` as YearMonth, 12);
    const bonuses: BonusPayment[] = planBonuses(input.bonusRules, input.bonusInstances, (m) => salaryAt(input, m), input.settings, input.assumptions, months, input.templates);
    return {
      year,
      base: salary.base,
      allowances: sum(salary.allowances.filter((a) => a.allowance.frequency === "monthly").map((a) => a.amount)),
      contributions: sum([pay.sss, pay.philhealth, pay.pagibig]),
      tax: pay.tax,
      first: pay.first.takeHome,
      second: pay.second.takeHome,
      bonusNet: sum(bonuses.map((b) => b.net)),
      assumed: salary.assumed,
    };
  });
}

export interface Effect {
  /** Change in take-home per month from the effective month, regular pay. */
  perMonth: Money;
  /** Total change in take-home over the next `months` months, bonuses included. */
  total: Money;
  /** Of that, the part that comes from bonuses (the 13th month and CIP follow base pay). */
  bonusPart: Money;
}

/** What adding an event does: per month, and over the next five years, comparing the input with and without it. */
export function eventEffect(before: SalaryInput, after: SalaryInput, from: YearMonth, months = 60): Effect {
  const range = monthRange(from, months);
  const total = (input: SalaryInput) => {
    const salaryOf = (m: YearMonth) => salaryAt(input, m);
    const bonuses = planBonuses(input.bonusRules, input.bonusInstances, salaryOf, input.settings, input.assumptions, range, input.templates);
    const regular = sum(range.map((m) => buildMonthPay(salaryOf(m), input.settings, [], input.templates).takeHome));
    return { regular, bonus: sum(bonuses.map((b) => b.net)) };
  };
  const a = total(after);
  const b = total(before);
  const pay = (i: SalaryInput) => buildMonthPay(salaryAt(i, from), i.settings, [], i.templates).takeHome;
  return { perMonth: sub(pay(after), pay(before)), total: sub((a.regular + a.bonus) as Money, (b.regular + b.bonus) as Money), bonusPart: sub(a.bonus, b.bonus) };
}

export const zero = ZERO;
export const yearOf = (m: YearMonth): number => monthParts(m).year;
