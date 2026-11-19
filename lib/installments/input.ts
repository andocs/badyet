import { isCutoff, type Cutoff } from "@/lib/budget/validate";
import { parsePesos, ZERO, type Money } from "@/lib/domain/money";
import { isUuid, isValidIsoDate } from "@/lib/plans/validate";

export interface InstalmentInput {
  name: string;
  price: Money;
  downPayment: Money;
  termCount: number;
  rateBp: number | null;
  firstDueOn: string;
  cutoff: Cutoff;
  walletId: string | null;
}
export type InstalmentParse = { ok: true; value: InstalmentInput } | { ok: false; error: string };

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const MAX = 10_000_000_000;

export function parseInstalmentForm(raw: Record<string, unknown>): InstalmentParse {
  const name = text(raw.name);
  if (name.length < 1 || name.length > 60) return { ok: false, error: "Give it a name (1 to 60 characters)." };
  const price = parsePesos(text(raw.price));
  if (price === undefined || price <= 0 || price > MAX) return { ok: false, error: "Enter the price as an amount like 20,000." };
  const downText = text(raw.downPayment);
  const downPayment = downText === "" ? ZERO : parsePesos(downText);
  if (downPayment === undefined || downPayment < 0 || downPayment >= price) {
    return { ok: false, error: "The down payment must be less than the price." };
  }
  const term = Number(text(raw.termCount));
  if (!Number.isInteger(term) || term < 1 || term > 600) {
    return { ok: false, error: "Number of payments must be a whole number from 1 to 600." };
  }
  const aprText = text(raw.apr);
  let rateBp: number | null = null;
  if (aprText !== "") {
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(aprText) || Number(aprText) > 100) {
      return { ok: false, error: "Interest must be a yearly percent like 6 or 6.5." };
    }
    rateBp = Math.round(Number(aprText) * 100);
  }
  const firstDueOn = text(raw.firstDueOn);
  if (!isValidIsoDate(firstDueOn)) return { ok: false, error: "Pick the date of the first payment." };
  if (!isCutoff(raw.cutoff)) return { ok: false, error: "Pick the cutoff you pay it in." };
  const wallet = text(raw.walletId);
  if (wallet !== "" && !isUuid(wallet)) return { ok: false, error: "Pick a wallet from the list." };
  return {
    ok: true,
    value: { name, price, downPayment, termCount: term, rateBp, firstDueOn, cutoff: raw.cutoff, walletId: wallet === "" ? null : wallet },
  };
}
