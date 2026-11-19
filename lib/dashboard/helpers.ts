import type { Cutoff } from "@/lib/budget/validate";
import { monthLabel } from "@/lib/transfer/month";

// ASSUMPTION (open question Q1): the 1st cutoff is the 1st to the 15th, the 2nd is the 16th to month end.
export function currentCutoff(todayIso: string): Cutoff {
  return Number(todayIso.slice(8, 10)) <= 15 ? "first" : "second";
}

export function daysInMonthOf(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function cutoffLabel(month: string, cutoff: Cutoff): string {
  const mon = monthLabel(month).split(" ")[0];
  return cutoff === "first" ? `First cutoff · ${mon} 1 to 15` : `Second cutoff · ${mon} 16 to ${daysInMonthOf(month)}`;
}

// Whole days from `fromIso` to `toIso` (both YYYY-MM-DD). Negative if `toIso` is earlier.
export function daysBetween(fromIso: string, toIso: string): number {
  const ms = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.round((ms(toIso) - ms(fromIso)) / 86_400_000);
}
