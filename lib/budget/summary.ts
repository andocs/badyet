import { add, sub, sum, ZERO, type Money } from "@/lib/domain/money";
import { budgetLeft, budgetLeftMonth, type BudgetLine } from "@/lib/domain/budget";
import type { Bucket, Cutoff } from "./validate";

export interface Line {
  id: string;
  cutoff: Cutoff;
  bucket: Bucket;
  name: string;
  amount: Money;
}

export interface CutoffSummary {
  net: Money;
  total: Money;
  left: Money;
}

// The domain helper wants wallet and active flags; wallets arrive in a later slice.
const asDomain = (lines: readonly Line[]): BudgetLine[] =>
  lines.map((l) => ({ id: l.id, walletId: null, cutoff: l.cutoff, amount: l.amount, active: true }));

export function bucketTotal(lines: readonly Line[], cutoff: Cutoff, bucket: Bucket): Money {
  return sum(lines.filter((l) => l.cutoff === cutoff && l.bucket === bucket).map((l) => l.amount));
}

export function summarize(lines: readonly Line[], netFirst: Money, netSecond: Money) {
  const d = asDomain(lines);
  const cut = (cutoff: Cutoff, net: Money): CutoffSummary => {
    const left = budgetLeft(net, d, cutoff);
    return { net, total: sub(net, left), left };
  };
  const first = cut("first", netFirst);
  const second = cut("second", netSecond);
  const month: CutoffSummary = {
    net: add(netFirst, netSecond),
    total: add(first.total, second.total),
    left: budgetLeftMonth(netFirst, netSecond, d),
  };
  return { first, second, month };
}

export { ZERO };
