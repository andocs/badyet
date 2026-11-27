import { addMonths, monthOf, periodOf, type IsoDate, type YearMonth } from "@/lib/domain/dates";
import { atLeastZero, money, sum, type Money } from "@/lib/domain/money";
import type { Move, Place } from "@/lib/budget/moves";
import { cutoffSettingsFromPaydays } from "@/lib/engine/months";
import { shortDate } from "@/lib/now/format";
import type { Fund } from "@/lib/engine/types";

/** What lent or sent money came out of. */
export type SourceKind = "none" | "wants" | "line" | "fund" | "bonus";

export interface LoanSource {
  kind: SourceKind;
  /** A budget line or fund id, or "rule id|year" for a bonus. null for Wants and none. */
  ref: string | null;
  name: string | null;
}

export interface LoanEvent {
  id: string;
  kind: "payment" | "postpone";
  on: IsoDate;
  amount: Money | null;
  oldDue: IsoDate | null;
  newDue: IsoDate | null;
  note: string | null;
  /** The account a payment arrived in, when it is one of yours. */
  accountName: string | null;
  txnId: string | null;
}

export interface Loan {
  id: string;
  borrower: string;
  amount: Money;
  lentOn: IsoDate;
  dueOn: IsoDate;
  from: LoanSource;
  /** The account the money left from, when it is one of yours. */
  accountId: string | null;
  accountName: string | null;
  note: string | null;
  /** The transaction the money left in, when there is one. */
  txnId: string | null;
  /** Oldest first. */
  events: LoanEvent[];
}

/** Money sent to someone else's account that is not spending and not a loan, but is taken from somewhere. */
export interface Outside {
  id: string;
  owner: string;
  amount: Money;
  on: IsoDate;
  from: LoanSource;
  accountId: string | null;
}

export const paidOf = (l: Loan): Money => sum(l.events.filter((e) => e.kind === "payment").map((e) => e.amount ?? money(0)));
export const outstandingOf = (l: Loan): Money => atLeastZero(money(l.amount - paidOf(l)));
export const postponedTimes = (l: Loan): number => l.events.filter((e) => e.kind === "postpone").length;

const daysBetween = (a: IsoDate, b: IsoDate): number => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Days past the expected date: 0 on the day itself, negative before it. */
export const daysLate = (l: Pick<Loan, "dueOn">, today: IsoDate): number => daysBetween(l.dueOn, today);

/** Loans to ask about today: something is still owed and the expected day has arrived. The longest overdue first. */
export function dueLoans(loans: readonly Loan[], today: IsoDate): Loan[] {
  return loans.filter((l) => outstandingOf(l) > 0 && l.dueOn <= today).sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.borrower.localeCompare(b.borrower));
}

/** Open loans (soonest due first), then paid ones (newest first). */
export function sortLoans(loans: readonly Loan[]): { open: Loan[]; paid: Loan[] } {
  return {
    open: loans.filter((l) => outstandingOf(l) > 0).sort((a, b) => a.dueOn.localeCompare(b.dueOn)),
    paid: loans.filter((l) => outstandingOf(l) === 0).sort((a, b) => b.lentOn.localeCompare(a.lentOn)),
  };
}

/** One change to a source on one day: negative = money left it, positive = it came back. */
export interface Draw {
  from: LoanSource;
  on: IsoDate;
  amount: number;
  /** Such as "lent to Sam" or "paid back by Sam". */
  text: string;
}

export function draws(loans: readonly Loan[], outside: readonly Outside[]): Draw[] {
  const out: Draw[] = [];
  for (const l of loans) {
    if (l.from.kind === "none") continue;
    out.push({ from: l.from, on: l.lentOn, amount: -l.amount, text: `lent to ${l.borrower}` });
    for (const e of l.events) if (e.kind === "payment" && e.amount) out.push({ from: l.from, on: e.on, amount: e.amount, text: `paid back by ${l.borrower}` });
  }
  for (const o of outside) if (o.from.kind !== "none") out.push({ from: o.from, on: o.on, amount: -o.amount, text: `sent to ${o.owner}` });
  return out;
}

/** The Wants and budget-line changes of one budget month, as moves for the Budget page. */
export function lendingMoves(list: readonly Draw[], paydays: { first: number; second: number }, month: YearMonth): Move[] {
  const settings = cutoffSettingsFromPaydays(paydays.first, paydays.second);
  const out: Move[] = [];
  for (const d of list) {
    const source: Place | null = d.from.kind === "wants" ? { kind: "wants" } : d.from.kind === "line" && d.from.ref ? { kind: "pool", lineId: d.from.ref, name: d.from.name ?? "that line" } : null;
    if (!source || d.amount === 0) continue;
    const period = periodOf(d.on, settings);
    if (monthOf(period.start) !== month) continue;
    // The other side is a person: it has no line on the page, so only the source's side shows.
    const person: Place = { kind: "pool", lineId: null, name: d.text };
    out.push({ from: d.amount < 0 ? source : person, to: d.amount < 0 ? person : source, amount: Math.abs(d.amount), cutoff: period.which === 1 ? "first" : "second", counted: true, text: d.text });
  }
  return out;
}

/** The changes to Wants (lineId null) and to budget lines inside one cutoff, for the Now page. */
export function cutoffDraws(list: readonly Draw[], period: { start: IsoDate; end: IsoDate }): { lineId: string | null; amount: number }[] {
  return list
    .filter((d) => d.on >= period.start && d.on <= period.end && (d.from.kind === "wants" || (d.from.kind === "line" && d.from.ref !== null)))
    .map((d) => ({ lineId: d.from.kind === "line" ? d.from.ref : null, amount: d.amount }));
}

/** Lent money still out of a savings fund, and the month the forecast expects it back. */
export interface Held {
  fundId: string;
  amount: Money;
  backMonth: YearMonth;
}

/**
 * What lending does to savings funds. `balances` are today's balances with money that is out taken off. `held` is what the forecast
 * keeps out until the expected month. A fund linked to the very account the money left from already shows it gone, so nothing more is
 * taken off its balance.
 */
export function fundLending(
  funds: readonly Pick<Fund, "id" | "linkedAccountId">[],
  start: Readonly<Record<string, Money>>,
  loans: readonly Loan[],
  outside: readonly Outside[],
  today: IsoDate,
): { balances: Record<string, Money>; held: Held[] } {
  const balances: Record<string, Money> = { ...start };
  const held: Held[] = [];
  const byId = new Map(funds.map((f) => [f.id, f]));
  const takeOff = (fundId: string, accountId: string | null, amount: number) => {
    const f = byId.get(fundId)!;
    if (f.linkedAccountId && f.linkedAccountId === accountId) return;
    balances[fundId] = atLeastZero(money((balances[fundId] ?? 0) - amount));
  };
  const thisMonth = monthOf(today);
  for (const l of loans) {
    const fundId = l.from.kind === "fund" ? l.from.ref : null;
    const owed = outstandingOf(l);
    if (!fundId || !byId.has(fundId) || owed === 0) continue;
    takeOff(fundId, l.accountId, owed);
    // Overdue money is not expected back before next month.
    held.push({ fundId, amount: owed, backMonth: l.dueOn < today ? addMonths(thisMonth, 1) : monthOf(l.dueOn) });
  }
  for (const o of outside) if (o.from.kind === "fund" && o.from.ref && byId.has(o.from.ref)) takeOff(o.from.ref, o.accountId, o.amount);
  return { balances, held };
}

/** Bonus money lent or sent, by bonus card key ("rule id|year"). */
export function bonusNotes(list: readonly Draw[]): Record<string, { text: string; amount: number }[]> {
  const out: Record<string, { text: string; amount: number }[]> = {};
  for (const d of list) if (d.from.kind === "bonus" && d.from.ref) (out[d.from.ref] ??= []).push({ text: d.text, amount: d.amount });
  return out;
}

/** Quick picks for the expected date. */
export function dueChips(today: IsoDate, paydays: { first: number; second: number }, weeks: 1 | 2 = 2): { label: string; date: IsoDate }[] {
  const day = Number(today.slice(8));
  const month = monthOf(today);
  const pad = (m: YearMonth, d: number) => `${m}-${String(d).padStart(2, "0")}` as IsoDate;
  const payday = day < paydays.first ? pad(month, paydays.first) : day < paydays.second ? pad(month, paydays.second) : pad(addMonths(month, 1), paydays.first);
  const later = new Date(Date.parse(today) + weeks * 7 * 86_400_000).toISOString().slice(0, 10) as IsoDate;
  const lastOf = (m: YearMonth) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)), 0)).toISOString().slice(0, 10) as IsoDate;
  const end = lastOf(month) > today ? lastOf(month) : lastOf(addMonths(month, 1));
  return [
    { label: `Next payday (${shortDate(payday)})`, date: payday },
    { label: weeks === 1 ? "In 1 week" : "In 2 weeks", date: later },
    { label: "End of month", date: end },
  ];
}
