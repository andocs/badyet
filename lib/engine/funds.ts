import type { YearMonth } from "@/lib/domain/dates";
import { monthParts } from "@/lib/domain/dates";
import { atLeastZero, min, mulBp, sub, ZERO, type Money } from "@/lib/domain/money";
import type { Fund, MonthOverride } from "./types";

/** Start balance per fund. Linked funds read their account; funds sharing one account get virtual shares (shareBp), which must add up to 100% or less. */
export function startBalances(funds: readonly Fund[], accountBalances: Readonly<Record<string, Money>>): Record<string, Money> {
  const byAccount = new Map<string, Fund[]>();
  for (const f of funds) if (f.linkedAccountId) byAccount.set(f.linkedAccountId, [...(byAccount.get(f.linkedAccountId) ?? []), f]);
  const out: Record<string, Money> = {};
  for (const f of funds) {
    const account = f.linkedAccountId;
    if (!account) {
      out[f.id] = f.startBalance ?? ZERO;
      continue;
    }
    const group = byAccount.get(account)!;
    const balance = accountBalances[account] ?? ZERO;
    if (group.length === 1) {
      out[f.id] = f.shareBp != null ? mulBp(balance, f.shareBp) : balance;
      continue;
    }
    if (group.some((g) => g.shareBp == null)) throw new RangeError("Funds sharing an account each need a share");
    if (group.reduce((t, g) => t + (g.shareBp ?? 0), 0) > 10000) throw new RangeError("Shares of one account add up to more than 100%");
    out[f.id] = mulBp(balance, f.shareBp!);
  }
  return out;
}

/** The next step boundary above a balance. Tranches list the step sizes; the last one repeats. */
function boundaryAfter(balance: Money, tranches: readonly Money[]): Money | null {
  if (tranches.length === 0) return null;
  let total = 0;
  for (const t of tranches) {
    total += t;
    if (total > balance) return total as Money;
  }
  const last = tranches[tranches.length - 1]!;
  if (last <= 0) return null;
  return (total + (Math.floor((balance - total) / last) + 1) * last) as Money;
}

const hasTarget = (f: Fund): f is Fund & { target: Money } => f.target != null && f.target > 0;

/** How much the fund can still take over time (ignores the monthly limit). null = no limit. */
function room(f: Fund, balance: Money): Money | null {
  if (f.rule === "steps") return hasTarget(f) ? atLeastZero(sub(f.target, balance)) : null;
  if (f.rule === "cap" || f.rule === "reset") return f.target != null ? atLeastZero(sub(f.target, balance)) : null;
  return hasTarget(f) ? atLeastZero(sub(f.target, balance)) : null;
}

/** What the fund asks of the pool this month. null = takes whatever is left. */
function demand(f: Fund, balance: Money): Money | null {
  let d: Money | null;
  if (f.rule === "steps") {
    const b = boundaryAfter(balance, f.tranches ?? []);
    const cap = hasTarget(f) && balance >= f.target ? ZERO : b === null ? null : hasTarget(f) ? min(b, f.target) : b;
    d = cap === null ? room(f, balance) : atLeastZero(sub(cap, balance));
  } else if (f.rule === "fixed") {
    const r = room(f, balance);
    d = r === null ? (f.fixedAmount ?? ZERO) : min(f.fixedAmount ?? ZERO, r);
  } else {
    d = room(f, balance);
  }
  if (f.maxPerMonth != null) d = d === null ? f.maxPerMonth : min(d, f.maxPerMonth);
  return d;
}

export interface FundMonthRow {
  fundId: string;
  /** Taken from the month's pool. */
  amount: Money;
  /** Money credited straight to this fund this month, not taken from the pool: net bonuses and a payroll savings plan (capped by room). */
  bonus: Money;
  balanceAfter: Money;
  /** Why the fund got what it got: `priority n`, `pinned`, `skipped`, `cap hit`, `pool ran out`, `takes the rest`. */
  reasons: string[];
}

export interface FundMonth {
  month: YearMonth;
  pool: Money;
  /** Pool money no fund took. */
  unplaced: Money;
  /** Bonus money a fund had no room for. */
  bonusUnplaced: Money;
  funds: FundMonthRow[];
}

export interface FundForecastMonth {
  month: YearMonth;
  pool: Money;
  /** Net bonuses assigned to funds, by fund id. They go straight to the fund, not through the pool. */
  bonusCredits?: Readonly<Record<string, Money>>;
}

function defaultOrder(funds: readonly Fund[]): Fund[] {
  return [...funds].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

/**
 * Allocate the savings pool to funds month by month. Order of events in a month: reset funds whose reset month it is, credit bonus money
 * (capped by room), take pinned amounts from the pool first, then fill funds in the month's order (an override's order first, the rest by
 * priority), each taking min(demand, what is left). Skipped funds get nothing; a fund is never both pinned and skipped.
 */
export function allocateFunds(
  fundsIn: readonly Fund[],
  start: Readonly<Record<string, Money>>,
  months: readonly FundForecastMonth[],
  overrides: readonly MonthOverride[] = [],
): FundMonth[] {
  const funds = defaultOrder(fundsIn.filter((f) => !f.archived));
  const balance: Record<string, Money> = {};
  for (const f of funds) balance[f.id] = start[f.id] ?? ZERO;
  const overrideOf = new Map(overrides.map((o) => [o.month, o]));
  const out: FundMonth[] = [];

  for (const m of months) {
    const monthNumber = monthParts(m.month).month;
    for (const f of funds) if (f.rule === "reset" && f.resetMonth === monthNumber) balance[f.id] = ZERO;

    const o = overrideOf.get(m.month);
    const skips = new Set(o?.skips ?? []);
    const pins = o?.pins ?? {};
    const rows = new Map<string, FundMonthRow>(funds.map((f) => [f.id, { fundId: f.id, amount: ZERO, bonus: ZERO, balanceAfter: ZERO, reasons: [] }]));

    let bonusUnplaced = ZERO;
    for (const [fundId, credit] of Object.entries(m.bonusCredits ?? {})) {
      const f = funds.find((x) => x.id === fundId);
      if (!f) {
        bonusUnplaced = (bonusUnplaced + credit) as Money;
        continue;
      }
      const r = room(f, balance[fundId]!);
      const taken = r === null ? credit : min(credit, r);
      balance[fundId] = (balance[fundId]! + taken) as Money;
      rows.get(fundId)!.bonus = taken;
      bonusUnplaced = (bonusUnplaced + (credit - taken)) as Money;
    }

    let left = m.pool > 0 ? m.pool : ZERO;
    const pinned = new Set<string>();
    for (const f of funds) {
      const pin = pins[f.id];
      if (pin === undefined || skips.has(f.id)) continue;
      const r = room(f, balance[f.id]!);
      const taken = min(min(pin, left), r === null ? pin : r);
      balance[f.id] = (balance[f.id]! + taken) as Money;
      rows.get(f.id)!.amount = taken;
      rows.get(f.id)!.reasons.push("pinned");
      left = sub(left, taken);
      pinned.add(f.id);
    }

    const listed = (o?.order ?? []).map((id) => funds.find((f) => f.id === id)).filter((f): f is Fund => f !== undefined);
    const order = [...listed, ...funds.filter((f) => !listed.includes(f))];
    order.forEach((f, i) => {
      const row = rows.get(f.id)!;
      if (skips.has(f.id)) {
        row.reasons.push("skipped");
        return;
      }
      if (pinned.has(f.id)) return;
      row.reasons.push(`priority ${i + 1}`);
      const d = demand(f, balance[f.id]!);
      const taken = d === null ? left : min(d, left);
      balance[f.id] = (balance[f.id]! + taken) as Money;
      row.amount = taken;
      left = sub(left, taken);
      if (d === null) row.reasons.push("takes the rest");
      else if (taken < d) row.reasons.push("pool ran out");
      else row.reasons.push("cap hit");
    });

    for (const f of funds) rows.get(f.id)!.balanceAfter = balance[f.id]!;
    out.push({ month: m.month, pool: m.pool, unplaced: left, bonusUnplaced, funds: funds.map((f) => rows.get(f.id)!) });
  }
  return out;
}
