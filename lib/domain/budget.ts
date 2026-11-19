import type { Money } from './money';
import { add, sub, sum } from './money';

/** Budget lines, wallet transfers and the buffer (planning doc, F.4). */

export interface BudgetLine {
  readonly id: string;
  readonly walletId: string | null;
  readonly cutoff: 'first' | 'second';
  /** Signed. Reimbursements and prepayments are negative. */
  readonly amount: Money;
  readonly active: boolean;
}

export function walletTotal(lines: readonly BudgetLine[], walletId: string, cutoff: 'first' | 'second'): Money {
  return sum(
    lines.filter((l) => l.active && l.walletId === walletId && l.cutoff === cutoff).map((l) => l.amount),
  );
}

export function budgetLeft(net: Money, lines: readonly BudgetLine[], cutoff: 'first' | 'second'): Money {
  return sub(net, sum(lines.filter((l) => l.active && l.cutoff === cutoff).map((l) => l.amount)));
}

export function budgetLeftMonth(
  netFirst: Money,
  netSecond: Money,
  lines: readonly BudgetLine[],
): Money {
  return add(budgetLeft(netFirst, lines, 'first'), budgetLeft(netSecond, lines, 'second'));
}

export function unallocated(left: Money, bufferTarget: Money): Money {
  return sub(left, bufferTarget);
}
