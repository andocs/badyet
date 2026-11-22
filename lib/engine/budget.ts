import type { YearMonth } from "@/lib/domain/dates";
import { atLeastZero, divRound, mulBp, sub, sum, ZERO, type Money } from "@/lib/domain/money";
import type { BudgetLine, PayCutoff, RaiseAllocation, SalaryEvent } from "./types";

export interface TopUp {
  salaryEventId: string;
  first: Money;
  second: Money;
}

export interface LineAmount {
  lineId: string;
  name: string;
  first: Money;
  second: Money;
  total: Money;
  /** Raise top-ups already included in the amounts, so Budget can tag "+₱500 from the Jul 2027 raise". */
  topUps: TopUp[];
}

export interface BudgetInput {
  month: YearMonth;
  takeHome: Record<PayCutoff, Money>;
  lines: readonly BudgetLine[];
  /** Raise allocations to apply. The caller drops those of expected events for the "without expected raises" view. */
  allocations?: readonly RaiseAllocation[];
  events?: readonly Pick<SalaryEvent, "id" | "effectiveMonth">[];
  /** Extra take-home each raise adds per cutoff (percent allocations are a share of this). */
  raiseExtras?: Readonly<Record<string, Record<PayCutoff, Money>>>;
  /** Flag a cutoff as tight when the rest line falls below this. Default 0 (never tight). */
  tightBelow?: Money;
  includeDrafts?: boolean;
}

export interface BudgetMonth {
  month: YearMonth;
  lines: LineAmount[];
  /** Fixed and percent lines per cutoff (everything but the rest line). */
  planned: Record<PayCutoff, Money>;
  /** Money reimbursed into each cutoff by the lines that are on this month. */
  reimbursed: Record<PayCutoff, Money>;
  rest: Record<PayCutoff, Money>;
  /** Fixed and percent lines add up to more than the take-home. */
  over: Record<PayCutoff, boolean>;
  tight: Record<PayCutoff, boolean>;
  /** Sum of lines in groups that feed savings, including the rest line, for the month. */
  savingsPool: Money;
  /** Per cutoff: the lines that count towards the daily amount. */
  dailyPool: Record<PayCutoff, Money>;
  /** Per cutoff: the lines flagged RTO (they fund the office-day budget). */
  rtoTotal: Record<PayCutoff, Money>;
}

const CUTOFFS: readonly PayCutoff[] = ["first", "second"];

function isOn(line: BudgetLine, month: YearMonth, includeDrafts: boolean): boolean {
  if (line.isDraft && !includeDrafts) return false;
  return (line.startsOn == null || line.startsOn <= month) && (line.endsOn == null || line.endsOn >= month);
}

const applies = (line: BudgetLine, cutoff: PayCutoff): boolean => line.cutoff === "both" || line.cutoff === cutoff;

/**
 * One month of the budget. A fixed line is its amount; a percent line is its share of that cutoff's take-home; the rest line is
 * the take-home minus every other line, floored at zero (with several rest lines the first one takes it). A line is on only
 * between its start and end months. A line with cutoff "both" applies its amount to each cutoff, or `amountSecond` to the second.
 * A reimbursement adds to what its cutoff has, so the rest line and the over flag see it.
 */
export function evaluateBudget(input: BudgetInput): BudgetMonth {
  const { month, takeHome } = input;
  const includeDrafts = input.includeDrafts === true;
  const eventMonth = new Map((input.events ?? []).map((e) => [e.id, e.effectiveMonth]));
  const lines = input.lines.filter((l) => isOn(l, month, includeDrafts));

  const result = new Map<string, LineAmount>();
  const planned: Record<PayCutoff, Money> = { first: ZERO, second: ZERO };
  const reimbursed: Record<PayCutoff, Money> = { first: ZERO, second: ZERO };
  for (const line of lines) {
    if (line.reimburse && line.reimburse.amount > 0) reimbursed[line.reimburse.cutoff] = (reimbursed[line.reimburse.cutoff] + line.reimburse.amount) as Money;
    const row: LineAmount = { lineId: line.id, name: line.name, first: ZERO, second: ZERO, total: ZERO, topUps: [] };
    result.set(line.id, row);
    if (line.rule === "rest") continue;
    for (const c of CUTOFFS) {
      if (!applies(line, c)) continue;
      row[c] = line.rule === "pct" ? mulBp(takeHome[c], line.pctBp ?? 0) : c === "second" && line.cutoff === "both" && line.amountSecond != null ? line.amountSecond : (line.amount ?? ZERO);
    }
    for (const a of input.allocations ?? []) {
      if (a.budgetLineId !== line.id) continue;
      const effective = eventMonth.get(a.salaryEventId);
      if (effective === undefined || effective > month) continue;
      const topUp: TopUp = { salaryEventId: a.salaryEventId, first: ZERO, second: ZERO };
      for (const c of CUTOFFS) {
        if (!applies(line, c)) continue;
        const extra = input.raiseExtras?.[a.salaryEventId]?.[c] ?? ZERO;
        topUp[c] = a.mode === "amount" ? (a.amount ?? ZERO) : mulBp(atLeastZero(extra), a.pctBp ?? 0);
        row[c] = (row[c] + topUp[c]) as Money;
      }
      row.topUps.push(topUp);
    }
    for (const c of CUTOFFS) planned[c] = (planned[c] + row[c]) as Money;
  }

  const rest: Record<PayCutoff, Money> = { first: ZERO, second: ZERO };
  const over: Record<PayCutoff, boolean> = { first: false, second: false };
  const tight: Record<PayCutoff, boolean> = { first: false, second: false };
  const restLine = lines.find((l) => l.rule === "rest");
  for (const c of CUTOFFS) {
    const available = (takeHome[c] + reimbursed[c]) as Money;
    over[c] = planned[c] > available;
    rest[c] = atLeastZero(sub(available, planned[c]));
    if (restLine && applies(restLine, c)) {
      result.get(restLine.id)![c] = rest[c];
      tight[c] = rest[c] < (input.tightBelow ?? ZERO);
    }
  }
  for (const row of result.values()) row.total = (row.first + row.second) as Money;

  const sumBy = (pred: (l: BudgetLine) => boolean, c?: PayCutoff): Money =>
    sum(lines.filter(pred).flatMap((l) => (c ? [result.get(l.id)![c]] : [result.get(l.id)!.first, result.get(l.id)!.second])));
  return {
    month,
    lines: lines.map((l) => result.get(l.id)!),
    planned,
    reimbursed,
    rest,
    over,
    tight,
    savingsPool: sumBy((l) => l.feedsSavings),
    dailyPool: { first: sumBy((l) => l.countsToDaily && l.kind === "normal", "first"), second: sumBy((l) => l.countsToDaily && l.kind === "normal", "second") },
    rtoTotal: { first: sumBy((l) => l.kind === "rto", "first"), second: sumBy((l) => l.kind === "rto", "second") },
  };
}

// ---------- office days, pools, daily amount ----------

/** The day budget derived from the RTO lines: their cutoff total divided by the usual office days in the cutoff. Never typed. */
export function rtoDayBudget(rtoCutoffTotal: Money, usualOfficeDays: number): Money {
  return usualOfficeDays > 0 ? divRound(rtoCutoffTotal, usualOfficeDays) : ZERO;
}

export type PoolEntryKind = "fund" | "use" | "to_wants" | "settle_to_pool" | "settle_to_wants" | "over_from_wants" | "over_from_excess";

export interface PoolEntrySpec {
  kind: PoolEntryKind;
  amount: Money;
}

/**
 * Settle an office day: spent less than the day budget leaves the difference to the pool or to Wants; spent more is taken from Wants
 * or from the pool's excess. Returns null when spent equals the budget.
 */
export function settleOfficeDay(input: {
  budget: Money;
  spent: Money;
  underTo: "pool" | "wants";
  overFrom: "wants" | "excess";
}): PoolEntrySpec | null {
  const diff = input.budget - input.spent;
  if (diff === 0) return null;
  if (diff > 0) return { kind: input.underTo === "pool" ? "settle_to_pool" : "settle_to_wants", amount: diff as Money };
  return { kind: input.overFrom === "wants" ? "over_from_wants" : "over_from_excess", amount: (-diff) as Money };
}

/** An extra office day taps the contingency pool for one day budget. */
export function extraOfficeDayUse(dayBudget: Money): PoolEntrySpec {
  return { kind: "use", amount: dayBudget };
}

const POOL_SIGN: Record<PoolEntryKind, 1 | -1 | 0> = {
  fund: 1,
  use: -1,
  to_wants: -1,
  settle_to_pool: 1,
  settle_to_wants: 0, // goes to Wants, not through the pool
  over_from_wants: 0,
  over_from_excess: -1,
};

/** A pool's balance is computed from its entries, never stored. */
export function poolBalance(entries: readonly PoolEntrySpec[]): Money {
  return sum(entries.map((e) => (POOL_SIGN[e.kind] * e.amount) as Money));
}

/** Money moved to Wants for the cutoff: pool money moved on purpose, plus under-spent office days settled to Wants. */
export function movedToWants(entries: readonly PoolEntrySpec[]): Money {
  return sum(entries.filter((e) => e.kind === "to_wants" || e.kind === "settle_to_wants").map((e) => e.amount));
}

/** Taken out of Wants: office days that ran over and were covered from Wants. */
export function takenFromWants(entries: readonly PoolEntrySpec[]): Money {
  return sum(entries.filter((e) => e.kind === "over_from_wants").map((e) => e.amount));
}

/**
 * Safe to spend today = (daily lines in the cutoff, less confirmed spend, plus money moved to Wants, less Wants taken) divided by the
 * days left, plus the office-day amount on a usual office day. Never below zero.
 */
export function dailySafeToSpend(input: {
  dailyPool: Money;
  confirmedSpend: Money;
  movedToWants?: Money;
  takenFromWants?: Money;
  daysLeft: number;
  officeDayAmount?: Money;
  isUsualOfficeDay?: boolean;
}): Money {
  const pot = atLeastZero((input.dailyPool - input.confirmedSpend + (input.movedToWants ?? 0) - (input.takenFromWants ?? 0)) as Money);
  const perDay = divRound(pot, Math.max(1, input.daysLeft));
  return input.isUsualOfficeDay ? ((perDay + (input.officeDayAmount ?? 0)) as Money) : perDay;
}
