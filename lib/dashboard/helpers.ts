import type { Cutoff } from "@/lib/budget/validate";
import { DEFAULT_CUTOFFS, addMonths, isoDate, makeDate, periodFor, periodOf, yearMonth, type CutoffSettings } from "@/lib/domain/dates";

// Cutoffs run payday to payday. The 1st cutoff starts on `firstStartDay` and runs to the day before `secondStartDay`;
// the 2nd starts on `secondStartDay` and runs to the day before `firstStartDay` of the next month (so it can cross a month end).
// A cutoff belongs to the month it starts in: Jan 5 is still in December's 2nd cutoff. Default 11 and 25 (paydays on the 10th and 25th).
export type CutoffRule = CutoffSettings;
export const DEFAULT_RULE: CutoffRule = DEFAULT_CUTOFFS;

export interface CurrentPeriod {
  month: string; // YYYY-MM the cutoff started in
  cutoff: Cutoff;
}

export function currentPeriod(todayIso: string, rule: CutoffRule = DEFAULT_RULE): CurrentPeriod {
  const p = periodOf(isoDate(todayIso), rule);
  return { month: p.id.slice(0, 7), cutoff: p.which === 1 ? "first" : "second" };
}

// The cutoff a page shows: the one in the URL when it is valid, otherwise the cutoff you are in today.
export function resolveCutoff(param: unknown, todayIso: string, rule: CutoffRule = DEFAULT_RULE): Cutoff {
  return param === "first" || param === "second" ? param : currentPeriod(todayIso, rule).cutoff;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (iso: string) => `${MON[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;

export function cutoffRange(month: string, cutoff: Cutoff, rule: CutoffRule = DEFAULT_RULE): { start: string; end: string } {
  const p = periodFor(yearMonth(month), cutoff === "first" ? 1 : 2, rule);
  return { start: p.start, end: p.end };
}

export function cutoffLabel(month: string, cutoff: Cutoff, rule: CutoffRule = DEFAULT_RULE): string {
  const { start, end } = cutoffRange(month, cutoff, rule);
  return `${cutoff === "first" ? "First" : "Second"} cutoff · ${short(start)} to ${short(end)}`;
}

// The payday that starts the next cutoff after today's, and which cutoff (and month key) that is.
export function nextPayday(todayIso: string, rule: CutoffRule = DEFAULT_RULE): { start: string; month: string; cutoff: Cutoff } {
  const cur = currentPeriod(todayIso, rule);
  if (cur.cutoff === "first") return { start: makeDate(yearMonth(cur.month), rule.secondStartDay), month: cur.month, cutoff: "second" };
  const month = addMonths(yearMonth(cur.month), 1);
  return { start: makeDate(month, rule.firstStartDay), month, cutoff: "first" };
}

// Whole days from `fromIso` to `toIso` (both YYYY-MM-DD). Negative if `toIso` is earlier.
export function daysBetween(fromIso: string, toIso: string): number {
  const ms = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.round((ms(toIso) - ms(fromIso)) / 86_400_000);
}

// Reads your payday settings. Falls back to the defaults if none are saved (or the settings table is not updated yet).
export async function loadRule(supabase: { from: (t: string) => { select: (c: string) => { maybeSingle: () => PromiseLike<{ data: unknown }> } } } | null): Promise<CutoffRule> {
  if (!supabase) return DEFAULT_RULE;
  const { data } = await supabase.from("user_settings").select("first_cutoff_start_day,second_cutoff_start_day").maybeSingle();
  const row = data as { first_cutoff_start_day?: number; second_cutoff_start_day?: number } | null;
  const a = row?.first_cutoff_start_day;
  const b = row?.second_cutoff_start_day;
  return typeof a === "number" && typeof b === "number" && a >= 2 && b <= 28 && a < b ? { firstStartDay: a, secondStartDay: b } : DEFAULT_RULE;
}
