import type { Cutoff } from "@/lib/budget/validate";
import { monthLabel } from "@/lib/transfer/month";

// The 1st cutoff runs from day 1 up to the day before `secondStart`; the 2nd from `secondStart` to month end.
// `secondStart` is the user's setting (default 16, so the 1st cutoff is 1 to 15).
export const DEFAULT_SECOND_START = 16;

export function currentCutoff(todayIso: string, secondStart: number = DEFAULT_SECOND_START): Cutoff {
  return Number(todayIso.slice(8, 10)) < secondStart ? "first" : "second";
}

export function daysInMonthOf(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function cutoffLabel(month: string, cutoff: Cutoff, secondStart: number = DEFAULT_SECOND_START): string {
  const mon = monthLabel(month).split(" ")[0];
  return cutoff === "first"
    ? `First cutoff · ${mon} 1 to ${secondStart - 1}`
    : `Second cutoff · ${mon} ${secondStart} to ${daysInMonthOf(month)}`;
}

// Whole days from `fromIso` to `toIso` (both YYYY-MM-DD). Negative if `toIso` is earlier.
export function daysBetween(fromIso: string, toIso: string): number {
  const ms = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.round((ms(toIso) - ms(fromIso)) / 86_400_000);
}
