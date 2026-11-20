import {
  addMonths,
  isoDate,
  makeDate,
  periodFor,
  type CutoffSettings,
  type IsoDate,
  type Period,
  type YearMonth,
} from "@/lib/domain/dates";

/** `count` consecutive months starting at `from`. */
export function monthRange(from: YearMonth, count: number): YearMonth[] {
  const out: YearMonth[] = [];
  for (let i = 0; i < count; i += 1) out.push(addMonths(from, i));
  return out;
}

/**
 * Cutoff periods from paydays. Today's rule (kept): the first period starts the day after the first payday,
 * the second starts on the second payday itself (10th and 25th give 11 and 25).
 */
export function cutoffSettingsFromPaydays(firstPayday: number, secondPayday: number): CutoffSettings {
  return { firstStartDay: firstPayday + 1, secondStartDay: secondPayday };
}

export function monthCutoffs(month: YearMonth, settings: CutoffSettings): { first: Period; second: Period } {
  return { first: periodFor(month, 1, settings), second: periodFor(month, 2, settings) };
}

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: IsoDate): number {
  const d = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Every date from start to end, inclusive. */
export function datesIn(period: Pick<Period, "start" | "end">): IsoDate[] {
  const out: IsoDate[] = [];
  const t = Date.UTC(Number(period.start.slice(0, 4)), Number(period.start.slice(5, 7)) - 1, Number(period.start.slice(8, 10)));
  const end = Date.UTC(Number(period.end.slice(0, 4)), Number(period.end.slice(5, 7)) - 1, Number(period.end.slice(8, 10)));
  for (let ms = t; ms <= end; ms += 86_400_000) out.push(isoDate(new Date(ms).toISOString().slice(0, 10)));
  return out;
}

/** How many of the usual office weekdays fall inside the period. */
export function usualOfficeDays(period: Pick<Period, "start" | "end">, officeWeekdays: readonly number[]): number {
  return datesIn(period).filter((d) => officeWeekdays.includes(isoWeekday(d))).length;
}

export { makeDate };
