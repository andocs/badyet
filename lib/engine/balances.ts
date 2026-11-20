import { sum, type Money } from "@/lib/domain/money";

export interface Anchor {
  /** ISO timestamp. */
  asOf: string;
  amount: Money;
}

export interface Txn {
  /** ISO timestamp. */
  occurredAt: string;
  /** Negative = money out. */
  amount: Money;
  status: "pending" | "confirmed" | "ignored";
}

/**
 * Balance now = the latest anchor plus the confirmed transactions after it (model.md). Pending and ignored rows never count.
 * With no anchor the balance starts from zero.
 */
export function balanceNow(anchors: readonly Anchor[], txns: readonly Txn[]): Money {
  const anchor = [...anchors].sort((a, b) => Date.parse(b.asOf) - Date.parse(a.asOf))[0];
  const from = anchor ? Date.parse(anchor.asOf) : Number.NEGATIVE_INFINITY;
  const after = txns.filter((t) => t.status === "confirmed" && Date.parse(t.occurredAt) > from).map((t) => t.amount);
  return sum([...(anchor ? [anchor.amount] : []), ...after]);
}
