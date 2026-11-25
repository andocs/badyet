import { monthOf, periodOf, type IsoDate } from "@/lib/domain/dates";
import { money, sum, type Money } from "@/lib/domain/money";
import { cutoffSettingsFromPaydays } from "@/lib/engine/months";

/**
 * Office-day money settled to savings, by the budget month of the cutoff each day falls in (a 2nd cutoff that runs into the next
 * calendar month still belongs to the month it started in). It adds to that month's savings pool.
 */
export function savingsByMonth(
  pools: readonly { entries: readonly { kind: string; amount: Money; occurredOn: IsoDate }[] }[],
  paydays: { first: number; second: number },
): Record<string, Money> {
  const settings = cutoffSettingsFromPaydays(paydays.first, paydays.second);
  const out: Record<string, Money[]> = {};
  for (const p of pools) {
    for (const e of p.entries) {
      if (e.kind !== "settle_to_savings") continue;
      const month = monthOf(periodOf(e.occurredOn, settings).start);
      (out[month] ??= []).push(e.amount);
    }
  }
  return Object.fromEntries(Object.entries(out).map(([m, list]) => [m, money(sum(list))]));
}
