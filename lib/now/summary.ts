import { addMonths, makeDate, monthOf, periodOf, type IsoDate, type Period } from "@/lib/domain/dates";
import { atLeastZero, sub, sum, ZERO, type Money } from "@/lib/domain/money";
import { dailySafeToSpend, type BudgetMonth } from "@/lib/engine/budget";
import { cutoffSettingsFromPaydays, datesIn, isoWeekday } from "@/lib/engine/months";
import type { BudgetLine, PayCutoff } from "@/lib/engine/types";

export interface NowLine extends BudgetLine {
  categoryId: string;
  /** Destination account, when the line is a bill or transfer. */
  accountId: string | null;
}

export interface NowCategory {
  id: string;
  name: string;
  color: string | null;
  /** The category's group feeds the savings pool, so it is not an envelope on Now. */
  feedsSavings: boolean;
}

export interface NowTxn {
  id: string;
  /** ISO timestamp. */
  occurredAt: string;
  /** Negative = money out. */
  amount: Money;
  merchant: string | null;
  categoryId: string | null;
  budgetLineId: string | null;
  accountName: string;
  kind: "expense" | "income" | "transfer";
  status: "pending" | "confirmed" | "ignored";
}

export interface NowInput {
  today: IsoDate;
  paydays: { first: number; second: number };
  officeDays: readonly number[];
  /** Pesos added on a usual office day. */
  officeDayAmount: Money;
  budget: BudgetMonth;
  lines: readonly NowLine[];
  categories: readonly NowCategory[];
  /** Transactions dated inside the cutoff, any status. */
  txns: readonly NowTxn[];
  /** Pool money moved to Wants this cutoff, and Wants money taken for overspent office days. */
  movedToWants?: Money;
  takenFromWants?: Money;
}

export interface Envelope {
  categoryId: string;
  name: string;
  color: string;
  plan: Money;
  spent: Money;
  left: Money;
  /** What the plan allows by today (plan x days elapsed / days). */
  pace: Money;
  /** spent minus pace: positive = over pace. */
  overPace: Money;
  txns: NowTxn[];
}

export interface Bill {
  lineId: string;
  name: string;
  amount: Money;
  sent: boolean;
  /** The account the line goes to. */
  accountId: string;
  /** The confirmed payment that marks it sent this cutoff (the first one), for Undo. */
  txnId: string | null;
}

export interface NowView {
  period: Period;
  cutoff: PayCutoff;
  daysTotal: number;
  /** Days elapsed including today. */
  dayNumber: number;
  /** Days left including today. */
  daysLeft: number;
  nextPayday: IsoDate;
  /** What the daily lines allow for the cutoff, and what is spent against them. */
  pool: Money;
  spent: Money;
  left: Money;
  /** Safe to spend per day from today, without the office-day amount. */
  perDay: Money;
  /** Today's amount: perDay, plus the office-day amount on a usual office day. */
  today: Money;
  isUsualOfficeDay: boolean;
  /** The next usual office day after today in this cutoff, and its amount. */
  nextOffice: { date: IsoDate; amount: Money } | null;
  /** Spent by now against what the plan pace allows by now. */
  pace: Money;
  overPace: Money;
  /** Cumulative spend at the end of each day 0..dayNumber (index 0 is the cutoff's start). */
  cumulative: Money[];
  envelopes: Envelope[];
  bills: Bill[];
  billsTotalSent: Money;
  recent: NowTxn[];
  pendingCount: number;
}

/** The calendar date, in Asia/Manila, of an ISO timestamp. */
export function manilaDate(iso: string): IsoDate {
  return new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(0, 10) as IsoDate;
}

const PALETTE = ["var(--accent)", "var(--blue)", "var(--gold)", "var(--violet)", "var(--teal)", "var(--pink)"];
const daysBetween = (a: IsoDate, b: IsoDate): number => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** The cutoff that today falls in, plus its month's budget month key (the month the period starts in). */
export function currentCutoff(today: IsoDate, paydays: { first: number; second: number }): { period: Period; cutoff: PayCutoff; budgetMonth: ReturnType<typeof monthOf> } {
  const period = periodOf(today, cutoffSettingsFromPaydays(paydays.first, paydays.second));
  return { period, cutoff: period.which === 1 ? "first" : "second", budgetMonth: monthOf(period.start) };
}

export function buildNowView(input: NowInput): NowView {
  const { today, budget } = input;
  const { period, cutoff } = currentCutoff(today, input.paydays);
  const days = datesIn(period);
  const daysTotal = days.length;
  const dayNumber = Math.min(daysTotal, Math.max(1, daysBetween(period.start, today) + 1));
  const daysLeft = daysTotal - dayNumber + 1;
  const nextPayday = period.which === 1 ? makeDate(monthOf(period.start), input.paydays.second) : makeDate(addMonths(monthOf(period.start), 1), input.paydays.first);

  const lineById = new Map(input.lines.map((l) => [l.id, l]));
  const catById = new Map(input.categories.map((c) => [c.id, c]));
  const amountIn = (lineId: string): Money => budget.lines.find((l) => l.lineId === lineId)?.[cutoff] ?? ZERO;

  // Money out, confirmed, by category. Pending rows are shown but do not count until confirmed.
  const spendTxns = input.txns.filter((t) => t.kind === "expense" && t.status === "confirmed");
  const dailyCategories = new Set(input.lines.filter((l) => l.countsToDaily && l.kind === "normal").map((l) => l.categoryId));
  const dailySpend = spendTxns.filter((t) => t.categoryId !== null && dailyCategories.has(t.categoryId));

  const pool = budget.dailyPool[cutoff];
  const spent = sum(dailySpend.map((t) => (-t.amount) as Money));
  const perDay = dailySafeToSpend({ dailyPool: pool, confirmedSpend: spent, daysLeft, movedToWants: input.movedToWants, takenFromWants: input.takenFromWants });
  const isUsualOfficeDay = input.officeDays.includes(isoWeekday(today));
  const nextOfficeDate = days.find((d) => d > today && input.officeDays.includes(isoWeekday(d)));
  const paceMoney = Number((BigInt(pool) * BigInt(dayNumber)) / BigInt(daysTotal)) as Money;

  const cumulative: Money[] = [ZERO];
  for (let d = 1; d <= dayNumber; d += 1) {
    const day = days[d - 1]!;
    cumulative.push(sum(dailySpend.filter((t) => manilaDate(t.occurredAt) <= day).map((t) => (-t.amount) as Money)));
  }

  // Envelopes: one per category in a group that does not feed savings, with a planned amount this cutoff.
  const planByCategory = new Map<string, Money>();
  for (const l of budget.lines) {
    const line = lineById.get(l.lineId);
    if (!line || line.rule === "rest" || line.kind === "rto_contingency") continue;
    if (catById.get(line.categoryId)?.feedsSavings) continue;
    const amount = l[cutoff];
    if (amount > 0) planByCategory.set(line.categoryId, ((planByCategory.get(line.categoryId) ?? 0) + amount) as Money);
  }
  const envelopes: Envelope[] = [...planByCategory.entries()].map(([categoryId, plan], i) => {
    const cat = catById.get(categoryId)!;
    const catTxns = input.txns.filter((t) => t.categoryId === categoryId && t.kind === "expense" && t.status !== "ignored");
    const envSpent = sum(catTxns.filter((t) => t.status === "confirmed").map((t) => (-t.amount) as Money));
    const envPace = Number((BigInt(plan) * BigInt(dayNumber)) / BigInt(daysTotal)) as Money;
    return {
      categoryId,
      name: cat.name,
      color: cat.color ?? PALETTE[i % PALETTE.length]!,
      plan,
      spent: envSpent,
      left: sub(plan, envSpent),
      pace: envPace,
      overPace: sub(envSpent, envPace),
      txns: catTxns.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    };
  });

  const billLines = input.lines.filter((l) => l.accountId !== null && l.rule !== "rest" && amountIn(l.id) > 0);
  const paidBy = new Map<string, string>();
  for (const t of input.txns) if (t.budgetLineId !== null && t.status === "confirmed" && !paidBy.has(t.budgetLineId)) paidBy.set(t.budgetLineId, t.id);
  const bills: Bill[] = billLines.map((l) => ({ lineId: l.id, name: l.name, amount: amountIn(l.id), sent: paidBy.has(l.id), accountId: l.accountId!, txnId: paidBy.get(l.id) ?? null }));

  const recent = input.txns.filter((t) => t.status !== "ignored").sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 8);

  return {
    period,
    cutoff,
    daysTotal,
    dayNumber,
    daysLeft,
    nextPayday,
    pool,
    spent,
    left: atLeastZero(sub(pool, spent)),
    perDay,
    today: isUsualOfficeDay ? ((perDay + input.officeDayAmount) as Money) : perDay,
    isUsualOfficeDay,
    nextOffice: nextOfficeDate ? { date: nextOfficeDate, amount: (perDay + input.officeDayAmount) as Money } : null,
    pace: paceMoney,
    overPace: sub(spent, paceMoney),
    cumulative,
    envelopes,
    bills,
    billsTotalSent: sum(bills.filter((b) => b.sent).map((b) => b.amount)),
    recent,
    pendingCount: input.txns.filter((t) => t.status === "pending").length,
  };
}
