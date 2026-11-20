import { periodFor, addMonths, monthOf, type CutoffSettings, type IsoDate } from "@/lib/domain/dates";
import { money, type Money } from "@/lib/domain/money";
import { poolBalance, type PoolEntrySpec } from "@/lib/engine/budget";

/** How many cutoffs the pool has been funded for: every cutoff that overlaps the time from `createdOn` to `today`, the current one included. */
export function fundedCutoffs(createdOn: IsoDate, today: IsoDate, settings: CutoffSettings): number {
  let count = 0;
  for (let m = addMonths(monthOf(createdOn), -1); m <= monthOf(today); m = addMonths(m, 1)) {
    for (const which of [1, 2] as const) {
      const p = periodFor(m, which, settings);
      if (p.end >= createdOn && p.start <= today) count += 1;
    }
  }
  return count;
}

/** A pool's balance: what its budget line has put in each cutoff, plus its entries. Never stored. */
export function poolBalanceNow(input: { createdOn: IsoDate; today: IsoDate; settings: CutoffSettings; perCutoff: Money; entries: readonly PoolEntrySpec[] }): Money {
  const funded = money(fundedCutoffs(input.createdOn, input.today, input.settings) * input.perCutoff);
  return money(funded + poolBalance(input.entries));
}

/** Money above the pool's "keep up to" level, if it has one. */
export function poolExcess(balance: Money, keepUpTo: Money | null): Money {
  return keepUpTo === null ? money(0) : money(Math.max(0, balance - keepUpTo));
}
