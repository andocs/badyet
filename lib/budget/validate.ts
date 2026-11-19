import { parsePesos, type Money } from "@/lib/domain/money";

export type Cutoff = "first" | "second";
export type Bucket = "essentials" | "wants" | "savings";

export const BUCKETS: { id: Bucket; label: string }[] = [
  { id: "essentials", label: "Essentials" },
  { id: "wants", label: "Wants" },
  { id: "savings", label: "Savings" },
];

export const isCutoff = (v: unknown): v is Cutoff => v === "first" || v === "second";
export const isBucket = (v: unknown): v is Bucket => v === "essentials" || v === "wants" || v === "savings";

export interface LineInput {
  name: string;
  amount: Money;
}
export type LineResult = { ok: true; value: LineInput } | { ok: false; error: string };

const MAX = 10_000_000_000;

// Name 1 to 60 characters; amount like 1,234.50. Negative is allowed (reimbursements, prepayments).
export function validateLine(raw: { name?: unknown; amount?: unknown }): LineResult {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (name.length < 1 || name.length > 60) return { ok: false, error: "Give the line a name (1 to 60 characters)." };
  const text = typeof raw.amount === "string" ? raw.amount.trim() : "";
  const amount = parsePesos(text);
  if (amount === undefined || Math.abs(amount) > MAX) return { ok: false, error: "Enter an amount like 1,234.50." };
  return { ok: true, value: { name, amount } };
}
