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

/**
 * A fund that fills in steps has priority only up to its first step. Its later steps wait until every other fund with a cap is full
 * (see `othersFull`). This is where its priority ends; null = not a step fund, or no steps given.
 */
function firstStop(f: Fund): Money | null {
  if (f.rule !== "steps") return null;
  const b = boundaryAfter(ZERO, f.tranches ?? []);
  return b === null ? null : hasTarget(f) ? min(b, f.target) : b;
}

/** How much the fund can take while it has priority: up to its cap, or for a step fund up to its first step. null = no limit. */
function priorityRoom(f: Fund, balance: Money): Money | null {
  const r = room(f, balance);
  const stop = firstStop(f);
  if (stop === null) return r;
  const toStop = atLeastZero(sub(stop, balance));
  return r === null ? toStop : min(r, toStop);
}

/** Whether every other fund with a cap is full, so a step fund may go past its first step. Funds with no cap can never be full. */
function othersFull(self: Fund, funds: readonly Fund[], balance: Readonly<Record<string, Money>>, skips: ReadonlySet<string>): boolean {
  return funds.every((f) => f === self || f.rule === "steps" || skips.has(f.id) || !hasTarget(f) || balance[f.id]! >= f.target);
}

/** A step fund that still has steps after its first one. Only then do the funds with no cap wait their turn behind it. */
function hasLaterSteps(f: Fund, balance: Money): boolean {
  if (firstStop(f) === null) return false;
  const r = room(f, balance);
  return r === null || r > priorityRoom(f, balance)!;
}

/** What the fund asks of the pool this month while it has priority. null = takes whatever is left. */
function demand(f: Fund, balance: Money): Money | null {
  let d: Money | null;
  if (f.rule === "steps") {
    d = priorityRoom(f, balance);
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
  /** Net bonus money credited straight to this fund this month, not taken from the pool (capped by room). */
  bonus: Money;
  /** The payroll savings plan's money credited to this fund this month. It is real money out of your pay, so it is never capped. */
  plan: Money;
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
  /** Net bonus money going to general savings. It is not part of the pool: it fills funds down the month's order, ignoring monthly limits. */
  bonusSavings?: Money;
  /** The payroll savings plan's money, by fund id (only the fund the plan feeds). It lands in full, whatever the fund's target. */
  planCredits?: Readonly<Record<string, Money>>;
}

function defaultOrder(funds: readonly Fund[]): Fund[] {
  return [...funds].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

/**
 * The order funds fill in for a month when you have not changed it: your priority order, except that in January the funds that reset
 * each year come first, ahead of the emergency fund and the rest. The payroll savings plan's fund never resets, so it stays put.
 */
export function monthOrder<T extends { id: string; rule: Fund["rule"] }>(inPriority: readonly T[], month: string, planFundId: string | null = null): T[] {
  if (Number(month.slice(5, 7)) !== 1) return [...inPriority];
  const resets = (f: T) => f.rule === "reset" && f.id !== planFundId;
  return [...inPriority.filter(resets), ...inPriority.filter((f) => !resets(f))];
}

/**
 * Allocate the savings pool to funds month by month. Order of events in a month: reset funds whose reset month it is, add the payroll
 * savings plan, pour bonus savings down the month's order (each fund up to its cap; see the passes below), take pinned amounts from the pool first, then fill funds in the month's order (an override's order first, the rest by
 * priority), each taking min(demand, what is left). Skipped funds get nothing; a fund is never both pinned and skipped.
 */
export function allocateFunds(
  fundsIn: readonly Fund[],
  start: Readonly<Record<string, Money>>,
  months: readonly FundForecastMonth[],
  overrides: readonly MonthOverride[] = [],
  /** The fund the payroll savings plan feeds: it never resets, so the plan's money is not wiped each year. */
  planFundId: string | null = null,
): FundMonth[] {
  const funds = defaultOrder(fundsIn.filter((f) => !f.archived));
  const balance: Record<string, Money> = {};
  for (const f of funds) balance[f.id] = start[f.id] ?? ZERO;
  const overrideOf = new Map(overrides.map((o) => [o.month, o]));
  const out: FundMonth[] = [];

  for (const m of months) {
    const monthNumber = monthParts(m.month).month;
    for (const f of funds) if (f.rule === "reset" && f.resetMonth === monthNumber && f.id !== planFundId) balance[f.id] = ZERO;

    const o = overrideOf.get(m.month);
    const skips = new Set(o?.skips ?? []);
    const pins = o?.pins ?? {};
    const rows = new Map<string, FundMonthRow>(funds.map((f) => [f.id, { fundId: f.id, amount: ZERO, bonus: ZERO, plan: ZERO, balanceAfter: ZERO, reasons: [] }]));

    let bonusUnplaced = ZERO;

    // The payroll savings plan goes in full: it was already taken from your pay, so a full fund does not turn it away.
    for (const [fundId, credit] of Object.entries(m.planCredits ?? {})) {
      const f = funds.find((x) => x.id === fundId);
      if (!f) {
        bonusUnplaced = (bonusUnplaced + credit) as Money;
        continue;
      }
      balance[fundId] = (balance[fundId]! + credit) as Money;
      rows.get(fundId)!.plan = credit;
    }

    const listed = (o?.order ?? []).map((id) => funds.find((f) => f.id === id)).filter((f): f is Fund => f !== undefined);
    const order = [...listed, ...monthOrder(funds, m.month, planFundId).filter((f) => !listed.includes(f))];

    // Bonus savings fill funds down this month's order (a chosen fund first, if the month names one), passing over skipped and full
    // funds, in three passes: every fund with a limit (a step fund only to its first step); then, once every other capped fund is
    // full, the later steps; then the funds with no cap take what is left (they only wait like this while a step fund has later
    // steps). "none" keeps it out of every fund.
    let waiting = m.bonusSavings ?? ZERO;
    if (o?.overflow !== "none") {
      const first = funds.find((f) => f.id === o?.overflow);
      const queue = (first ? [first, ...order.filter((x) => x !== first)] : order).filter((f) => !skips.has(f.id));
      const pour = (f: Fund, upTo: Money | null) => {
        const taken = upTo === null ? waiting : min(waiting, upTo);
        if (taken <= 0) return;
        balance[f.id] = (balance[f.id]! + taken) as Money;
        const row = rows.get(f.id)!;
        row.bonus = (row.bonus + taken) as Money;
        if (!row.reasons.includes("bonus savings")) row.reasons.push("bonus savings");
        waiting = sub(waiting, taken);
      };
      // The fund you chose to fill first takes up to its cap, whatever the passes would say.
      if (first && !skips.has(first.id)) pour(first, room(first, balance[first.id]!));
      const stepping = queue.some((f) => hasLaterSteps(f, balance[f.id]!));
      const noCap = (f: Fund) => priorityRoom(f, balance[f.id]!) === null;
      for (const f of queue) if (!(stepping && noCap(f))) pour(f, priorityRoom(f, balance[f.id]!));
      for (const f of queue) if (firstStop(f) !== null && othersFull(f, funds, balance, skips)) pour(f, room(f, balance[f.id]!));
      for (const f of queue) if (noCap(f)) pour(f, null);
    }
    bonusUnplaced = (bonusUnplaced + waiting) as Money;

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

    const give = (f: Fund, taken: Money) => {
      balance[f.id] = (balance[f.id]! + taken) as Money;
      const row = rows.get(f.id)!;
      row.amount = (row.amount + taken) as Money;
      left = sub(left, taken);
    };
    const takesTheRest: Fund[] = [];
    const stepping = order.some((f) => !skips.has(f.id) && !pinned.has(f.id) && hasLaterSteps(f, balance[f.id]!));
    order.forEach((f, i) => {
      const row = rows.get(f.id)!;
      if (skips.has(f.id)) {
        row.reasons.push("skipped");
        return;
      }
      if (pinned.has(f.id)) return;
      row.reasons.push(`priority ${i + 1}`);
      const d = demand(f, balance[f.id]!);
      if (d === null) {
        if (stepping) takesTheRest.push(f);
        else {
          give(f, left);
          row.reasons.push("takes the rest");
        }
        return;
      }
      const taken = min(d, left);
      give(f, taken);
      row.reasons.push(taken < d ? "pool ran out" : "cap hit");
    });
    // Later steps, only once every other capped fund is full. A monthly limit still counts what the fund already got.
    for (const f of order) {
      if (firstStop(f) === null || skips.has(f.id) || pinned.has(f.id)) continue;
      const row = rows.get(f.id)!;
      const r = room(f, balance[f.id]!);
      if (r !== null && r <= 0) continue;
      if (!othersFull(f, funds, balance, skips)) {
        if (balance[f.id]! >= firstStop(f)!) row.reasons.push("waits for other funds");
        continue;
      }
      const monthly = f.maxPerMonth != null ? atLeastZero(sub(f.maxPerMonth, row.amount)) : null;
      const can = r === null ? (monthly ?? left) : monthly === null ? r : min(r, monthly);
      const taken = min(can, left);
      if (taken <= 0) continue;
      give(f, taken);
      row.reasons.push("next step");
    }
    for (const f of takesTheRest) {
      give(f, left);
      rows.get(f.id)!.reasons.push("takes the rest");
    }

    for (const f of funds) rows.get(f.id)!.balanceAfter = balance[f.id]!;
    out.push({ month: m.month, pool: m.pool, unplaced: left, bonusUnplaced, funds: funds.map((f) => rows.get(f.id)!) });
  }
  return out;
}
