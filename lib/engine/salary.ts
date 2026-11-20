import { addMonths, monthParts, type YearMonth } from "@/lib/domain/dates";
import { mulBp, type Money } from "@/lib/domain/money";
import type { Allowance, Assumptions, PayCutoff, SalaryEvent } from "./types";

export interface MonthAllowance {
  allowance: Allowance;
  amount: Money;
}

export interface OneOff {
  amount: Money;
  taxable: boolean;
}

export interface MonthSalary {
  month: YearMonth;
  /** Monthly base pay in force. */
  base: Money;
  /** The base includes a raise that is only expected. */
  expected: boolean;
  /** The base includes a projected yearly raise (charts dash these months). */
  assumed: boolean;
  allowances: MonthAllowance[];
  oneOffs: OneOff[];
}

function inForce(a: Allowance, month: YearMonth): boolean {
  return a.startsOn <= month && (a.endsOn == null || a.endsOn >= month);
}

function allowanceAmountIn(a: Allowance, month: YearMonth): Money | null {
  if (!inForce(a, month)) return null;
  if (a.frequency === "monthly") return a.amount;
  // A yearly allowance is a one-time credit in its month.
  return monthParts(month).month === a.payMonth ? a.amount : null;
}

/**
 * Per month: base pay, allowances, one-offs. Events apply in order of effective month (confirmed before expected in the same
 * month). With includeExpected false, expected events and allowances tied to an expected event are ignored: the
 * "without expected raises" view. A projected yearly raise (Assumptions) applies only to years after the last salary
 * event's year, and is flagged `assumed`.
 */
export function resolveSalaryTimeline(
  events: readonly SalaryEvent[],
  allowances: readonly Allowance[],
  assumptions: Assumptions,
  months: readonly YearMonth[],
  opts: { includeExpected: boolean },
): MonthSalary[] {
  const used = events
    .filter((e) => opts.includeExpected || e.status === "confirmed")
    .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth) || (a.status === b.status ? a.id.localeCompare(b.id) : a.status === "confirmed" ? -1 : 1));
  const baseEvents = used.filter((e) => e.kind === "start" || e.kind === "merit" || e.kind === "promotion");
  const lastRaiseYear = baseEvents.length ? monthParts(baseEvents[baseEvents.length - 1]!.effectiveMonth).year : null;
  const eventOfAllowance = new Map<string, SalaryEvent>();
  for (const e of events) if (e.kind === "allowance" && e.allowanceId) eventOfAllowance.set(e.allowanceId, e);

  return months.map((month) => {
    let base = 0 as Money;
    let expected = false;
    for (const e of baseEvents) {
      if (e.effectiveMonth > month) break;
      if (e.kind === "merit" && e.newBase == null) {
        if (e.pctBp != null) base = mulBp(base, 10000 + e.pctBp);
      } else if (e.newBase != null) {
        base = e.newBase;
      }
      if (e.status === "expected") expected = true;
    }

    let assumed = false;
    if (assumptions.assumedRaiseOn && assumptions.assumedRaiseBp > 0 && lastRaiseYear !== null) {
      const { year, month: m } = monthParts(month);
      const raises = year - lastRaiseYear - (m >= assumptions.assumedRaiseMonth ? 0 : 1);
      for (let i = 0; i < raises; i += 1) base = mulBp(base, 10000 + assumptions.assumedRaiseBp);
      assumed = raises > 0;
    }

    const monthAllowances: MonthAllowance[] = [];
    for (const a of allowances) {
      const link = eventOfAllowance.get(a.id);
      if (link && link.status === "expected" && !opts.includeExpected) continue;
      const amount = allowanceAmountIn(a, month);
      if (amount !== null) monthAllowances.push({ allowance: a, amount });
    }
    const oneOffs = used
      .filter((e) => e.kind === "adjustment" && e.effectiveMonth === month && e.oneOffAmount != null)
      .map((e) => ({ amount: e.oneOffAmount as Money, taxable: e.oneOffTaxable === true }));
    return { month, base, expected, assumed, allowances: monthAllowances, oneOffs };
  });
}

/** The month before, for "extra take-home from a raise" comparisons. */
export function previousMonth(month: YearMonth): YearMonth {
  return addMonths(month, -1);
}

export function allowanceTotal(s: MonthSalary, cutoff: PayCutoff, taxable: boolean): Money {
  return s.allowances
    .filter((a) => a.allowance.payslipCutoff === cutoff && a.allowance.taxable === taxable)
    .reduce((t, a) => (t + a.amount) as Money, 0 as Money);
}
