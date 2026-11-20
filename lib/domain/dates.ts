/**
 * Calendar helpers on ISO text dates (YYYY-MM-DD) and months (YYYY-MM).
 * No time zones and no clock: a date is a calendar date in Asia/Manila by convention (F.1).
 */

declare const isoDateBrand: unique symbol;
declare const yearMonthBrand: unique symbol;

export type IsoDate = string & { readonly [isoDateBrand]: 'IsoDate' };
export type YearMonth = string & { readonly [yearMonthBrand]: 'YearMonth' };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

export function isoDate(text: string): IsoDate {
  const match = DATE_PATTERN.exec(text);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  const day = Number(match?.[3]);
  if (!match || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`Not a calendar date: ${text}`);
  }
  return text as IsoDate;
}

export function yearMonth(text: string): YearMonth {
  const match = MONTH_PATTERN.exec(text);
  const month = Number(match?.[2]);
  if (!match || month < 1 || month > 12) {
    throw new RangeError(`Not a year-month: ${text}`);
  }
  return text as YearMonth;
}

export function parts(date: IsoDate): { year: number; month: number; day: number } {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)) };
}

export function monthParts(ym: YearMonth): { year: number; month: number } {
  return { year: Number(ym.slice(0, 4)), month: Number(ym.slice(5, 7)) };
}

export function monthOf(date: IsoDate): YearMonth {
  return date.slice(0, 7) as YearMonth;
}

export function makeDate(ym: YearMonth, day: number): IsoDate {
  const { year, month } = monthParts(ym);
  return isoDate(`${pad(year, 4)}-${pad(month, 2)}-${pad(Math.min(day, daysInMonth(year, month)), 2)}`);
}

export function addMonths(ym: YearMonth, count: number): YearMonth {
  const { year, month } = monthParts(ym);
  const index = year * 12 + (month - 1) + count;
  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1, 2)}` as YearMonth;
}

/** Add months and keep the day, clamped to the end of a shorter month (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsClamped(date: IsoDate, count: number): IsoDate {
  const { day } = parts(date);
  return makeDate(addMonths(monthOf(date), count), day);
}

/** Whole months from a to b (negative if b is earlier). */
export function monthsBetween(a: YearMonth, b: YearMonth): number {
  const pa = monthParts(a);
  const pb = monthParts(b);
  return (pb.year - pa.year) * 12 + (pb.month - pa.month);
}

export function compareDates(a: IsoDate, b: IsoDate): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isJanuary(ym: YearMonth): boolean {
  return ym.endsWith('-01');
}

export interface CutoffSettings {
  /** First day of period 1 (default 11). */
  readonly firstStartDay: number;
  /** First day of period 2 (default 25). */
  readonly secondStartDay: number;
}

export const DEFAULT_CUTOFFS: CutoffSettings = { firstStartDay: 11, secondStartDay: 25 };

export interface Period {
  /** YYYY-MM-1 or YYYY-MM-2, using the month in which the period starts. */
  readonly id: string;
  readonly which: 1 | 2;
  readonly start: IsoDate;
  /** Last day of the period, inclusive. */
  readonly end: IsoDate;
}

/**
 * Period 1 runs from firstStartDay to the day before secondStartDay. Period 2 runs from
 * secondStartDay to the day before firstStartDay of the next month (F.1).
 */
export function periodOf(date: IsoDate, settings: CutoffSettings = DEFAULT_CUTOFFS): Period {
  const { day } = parts(date);
  const month = monthOf(date);
  if (day >= settings.secondStartDay) {
    return periodFor(month, 2, settings);
  }
  if (day >= settings.firstStartDay) {
    return periodFor(month, 1, settings);
  }
  return periodFor(addMonths(month, -1), 2, settings);
}

export function periodFor(month: YearMonth, which: 1 | 2, settings: CutoffSettings): Period {
  if (which === 1) {
    return {
      id: `${month}-1`,
      which,
      start: makeDate(month, settings.firstStartDay),
      end: makeDate(month, settings.secondStartDay - 1),
    };
  }
  return {
    id: `${month}-2`,
    which,
    start: makeDate(month, settings.secondStartDay),
    end: makeDate(addMonths(month, 1), settings.firstStartDay - 1),
  };
}
