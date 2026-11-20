import { isCutoff, type Cutoff } from "@/lib/budget/validate";
import { parsePesos, ZERO, type Money } from "@/lib/domain/money";
import { isValidIsoDate } from "@/lib/plans/validate";
import type { WindfallKind } from "./compute";

export interface EventInput {
  kind: WindfallKind;
  name: string;
  cutoff: Cutoff;
  payDate: string;
  gross: Money | null;
  cipEligible: Money | null;
  cipComponentNum: number | null;
  cipMultiplierNum: number | null;
  deMinimis: Money;
}
export type EventParse = { ok: true; value: EventInput } | { ok: false; error: string };

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const MAX = 10_000_000_000;
const amount = (t: string): Money | undefined => {
  const m = parsePesos(t);
  return m !== undefined && m > 0 && m <= MAX ? m : undefined;
};

export function parseEventForm(raw: Record<string, unknown>): EventParse {
  const kind = raw.kind;
  if (kind !== "thirteenth" && kind !== "cip" && kind !== "bonus") return { ok: false, error: "Pick the type: 13th month, CIP or bonus." };
  const name = text(raw.name);
  if (name.length < 1 || name.length > 60) return { ok: false, error: "Give it a name (1 to 60 characters)." };
  if (!isCutoff(raw.cutoff)) return { ok: false, error: "Pick the cutoff it is paid in." };
  const payDate = text(raw.payDate);
  if (!isValidIsoDate(payDate)) return { ok: false, error: "Pick the pay date." };
  const base: EventInput = { kind, name, cutoff: raw.cutoff, payDate, gross: null, cipEligible: null, cipComponentNum: null, cipMultiplierNum: null, deMinimis: ZERO };

  // Own de minimis exemption: CIP and bonus only, blank means none.
  const dmText = text(raw.deMinimis);
  const dm = dmText === "" ? ZERO : parsePesos(dmText);
  if (dm === undefined || dm < 0 || dm > MAX) return { ok: false, error: "Enter the de minimis exemption like 12,000, or leave it blank." };
  if (kind === "thirteenth" && dm > 0) return { ok: false, error: "The 13th month has no de minimis exemption." };
  base.deMinimis = dm;

  if (kind === "cip") {
    const eligible = amount(text(raw.cipEligible));
    const comp = text(raw.cipComponentPct);
    const mult = text(raw.cipMultiplier);
    if (eligible === undefined) return { ok: false, error: "CIP needs your eligible earnings, like 600,000." };
    if (!/^\d{1,3}(\.\d{1,5})?$/.test(comp) || Number(comp) <= 0) return { ok: false, error: "CIP needs your individual component as a percent, like 13.81505." };
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(mult) || Number(mult) <= 0) return { ok: false, error: "CIP needs the company multiplier, like 1.25." };
    return {
      ok: true,
      value: { ...base, cipEligible: eligible, cipComponentNum: Math.round(Number(comp) * 100_000), cipMultiplierNum: Math.round(Number(mult) * 100) },
    };
  }
  const grossText = text(raw.gross);
  if (grossText === "") {
    if (kind === "bonus") return { ok: false, error: "A bonus needs its gross amount." };
    return { ok: true, value: base }; // 13th month defaults to one month of basic pay
  }
  const gross = amount(grossText);
  if (gross === undefined) return { ok: false, error: "Enter the gross amount like 50,000." };
  if (dm > gross) return { ok: false, error: "The de minimis exemption cannot be more than the bonus." };
  return { ok: true, value: { ...base, gross } };
}
