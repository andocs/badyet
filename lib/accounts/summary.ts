import { money, sum, type Money } from "@/lib/domain/money";
import type { Kind } from "./input";

export interface AccountRow {
  kind: Kind;
  balance: Money;
  creditLimit: Money | null;
}
export interface Position {
  cash: Money; // e-wallets and debit accounts
  debt: Money; // owed on credit cards
  net: Money; // cash minus debt
  creditLimit: Money; // total limit of cards that have one
  utilizationPct: number | null; // owed / limit, only over cards that have a limit; null when no card has one
}

export function position(rows: readonly AccountRow[]): Position {
  const cards = rows.filter((r) => r.kind === "credit");
  const cash = sum(rows.filter((r) => r.kind !== "credit").map((r) => r.balance));
  const debt = sum(cards.map((r) => r.balance));
  const limited = cards.filter((r) => r.creditLimit !== null);
  const limit = sum(limited.map((r) => r.creditLimit as Money));
  const owedOnLimited = sum(limited.map((r) => r.balance));
  return {
    cash,
    debt,
    net: money(cash - debt),
    creditLimit: limit,
    utilizationPct: limit > 0 ? Math.round((owedOnLimited / limit) * 100) : null,
  };
}

// Days until the next time this day-of-month comes around (today counts as 0). Short months use their last day.
export function daysUntilDay(todayIso: string, dayOfMonth: number): number {
  const y = Number(todayIso.slice(0, 4));
  const m = Number(todayIso.slice(5, 7));
  const d = Number(todayIso.slice(8, 10));
  const lastThis = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const target = Math.min(dayOfMonth, lastThis);
  if (target >= d) return target - d;
  const lastNext = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return lastThis - d + Math.min(dayOfMonth, lastNext);
}
