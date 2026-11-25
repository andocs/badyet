import { sum, type Money } from "@/lib/domain/money";

/** A transfer between two of your accounts that the app recorded itself when you ticked the pay checklist. */
export interface RecordedTransfer {
  /** Both legs' ids, to mark them as matched. */
  outId: string;
  inId: string;
  fromId: string;
  toId: string;
  /** Positive. */
  amount: Money;
  /** Epoch ms. */
  at: number;
}

/** A transfer the app detected from a notification or email. */
export interface DetectedTransfer {
  fromId: string;
  toId: string;
  amount: Money;
  at: number;
}

/** Banks round and fees get added: amounts within ₱1 count as the same. */
const TOLERANCE = 100;
const DAY_MS = 24 * 60 * 60_000;

/**
 * A transfer detected from a bank notification or email may be one you already ticked in the pay checklist, which recorded it itself.
 * It is the same money if it is between the same two accounts, within a day, and either matches one recorded transfer, or equals
 * the sum of several you ticked line by line (you sent one lump at the bank and ticked its lines). Returns the recorded transfers it
 * duplicates, or null when it is a new transfer.
 */
export function duplicatedBy(detected: DetectedTransfer, recorded: readonly RecordedTransfer[]): RecordedTransfer[] | null {
  const near = recorded.filter((r) => r.fromId === detected.fromId && r.toId === detected.toId && Math.abs(r.at - detected.at) <= DAY_MS);
  const single = near.filter((r) => Math.abs(r.amount - detected.amount) <= TOLERANCE).sort((a, b) => Math.abs(a.at - detected.at) - Math.abs(b.at - detected.at))[0];
  if (single) return [single];
  if (near.length > 1 && Math.abs(sum(near.map((r) => r.amount)) - detected.amount) <= TOLERANCE) return near;
  return null;
}
