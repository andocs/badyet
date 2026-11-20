import type { IsoDate, Period } from "@/lib/domain/dates";
import { money, type Money } from "@/lib/domain/money";
import { datesIn, isoWeekday } from "@/lib/engine/months";

export interface OfficeDay {
  date: IsoDate;
  /** ISO weekday, 1 = Monday. */
  weekday: number;
  usual: boolean;
  /** Going in, after your taps: a usual day you did not skip, or an extra day you marked. */
  office: boolean;
  extra: boolean;
  skipped: boolean;
}

/** The days of a cutoff with their office status. A tapped day (override) beats the usual weekdays. */
export function cutoffOfficeDays(period: Pick<Period, "start" | "end">, usualWeekdays: readonly number[], overrides: ReadonlyMap<string, boolean>): OfficeDay[] {
  return datesIn(period).map((date) => {
    const weekday = isoWeekday(date);
    const usual = usualWeekdays.includes(weekday);
    const office = overrides.has(date) ? overrides.get(date)! : usual;
    return { date, weekday, usual, office, extra: office && !usual, skipped: usual && !office };
  });
}

export interface SettleRow {
  date: IsoDate;
  spent: Money;
  budget: Money;
  /** budget minus spent: positive = left over, negative = overspent. */
  diff: Money;
  settled: boolean;
}

/**
 * Office days that have ended with spending different from the day budget, so the user can say where the difference goes. A day is
 * settled once it has a settle entry. Differences under ₱1 are ignored.
 */
export function settleRows(input: { days: readonly OfficeDay[]; spendByDay: ReadonlyMap<string, Money>; dayBudget: Money; settledDays: ReadonlySet<string>; today: IsoDate }): SettleRow[] {
  return input.days
    .filter((d) => d.office && d.date < input.today && input.spendByDay.has(d.date))
    .map((d) => {
      const spent = input.spendByDay.get(d.date)!;
      return { date: d.date, spent, budget: input.dayBudget, diff: money(input.dayBudget - spent), settled: input.settledDays.has(d.date) };
    })
    .filter((r) => Math.abs(r.diff) >= 100 || r.settled);
}
