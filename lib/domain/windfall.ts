import type { Money } from './money';
import { fromRatio, sub, sum } from './money';

/** Windfalls: 13th month, CIP, bonus (planning doc, F.3). */

export interface WindfallAllocation {
  readonly eventId: string;
  readonly amount: Money;
  /** Records that the money was moved. It never changes the remaining amount. */
  readonly done: boolean;
}

/** Net windfall = pay with the bonus minus regular pay for the same period under the same rules. */
export function windfallNet(netWithBonus: Money, regularNet: Money): Money {
  return sub(netWithBonus, regularNet);
}

/** Remaining = net - allocations of this event only (fixes audit F-11). */
export function eventRemaining(
  eventId: string,
  net: Money,
  allocations: readonly WindfallAllocation[],
): Money {
  const allocated = sum(allocations.filter((a) => a.eventId === eventId).map((a) => a.amount));
  return sub(net, allocated);
}

export function allocatedTotal(eventId: string, allocations: readonly WindfallAllocation[]): Money {
  return sum(allocations.filter((a) => a.eventId === eventId).map((a) => a.amount));
}

export interface Ratio {
  readonly numerator: number;
  readonly denominator: number;
}

/**
 * CIP gross = eligible earnings x individual component x company multiplier, rounded once.
 * Components are ratios of integers (13.81505% is 1,381,505 / 10,000,000; a 1.25 multiplier is 125 / 100).
 */
export function cipGross(eligibleEarnings: Money, component: Ratio, multiplier: Ratio): Money {
  return fromRatio(
    BigInt(eligibleEarnings) * BigInt(component.numerator) * BigInt(multiplier.numerator),
    BigInt(component.denominator) * BigInt(multiplier.denominator),
  );
}
