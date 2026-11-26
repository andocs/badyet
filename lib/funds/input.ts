export interface FundInput {
  id?: string;
  name: string;
  color: string | null;
  rule: "steps" | "cap" | "reset" | "fixed";
  /** Cap, or the hard cap for steps. Centavos. */
  target: number | null;
  /** Steps: tranche sizes in centavos; the last repeats. */
  tranches: number[] | null;
  maxPerMonth: number | null;
  fixedAmount: number | null;
  resetMonth: number | null;
  linkedAccountId: string | null;
  /** Basis points of a shared account. */
  shareBp: number | null;
  startBalance: number | null;
}

export interface OverrideInput {
  /** YYYY-MM, one or many. */
  months: string[];
  /** Fund ids in this month's order, or null for the default order. */
  order: string[] | null;
  /** Fund id to a pinned amount in centavos. */
  pins: Record<string, number>;
  skips: string[];
  note: string | null;
  /** Where bonus money a full fund cannot take goes: null = next in priority, "none" = nowhere, or a fund id. */
  overflow: string | null;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX = 100_000_000_000;
const int = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
const orNull = (n: unknown): number | null | undefined => (n == null ? null : int(n, 0, MAX) ? n : undefined);

/** The server's check of a fund from the editor. The database repeats the field rules. */
export function validateFund(input: unknown): Checked<FundInput> {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Nothing to save." };
  const p = input as Record<string, unknown>;
  const name = typeof p.name === "string" ? p.name.trim() : "";
  if (name.length < 1 || name.length > 40) return { ok: false, error: "Give the fund a name of up to 40 characters." };
  if (p.id != null && (typeof p.id !== "string" || !UUID.test(p.id))) return { ok: false, error: "That fund was not found." };
  if (p.rule !== "steps" && p.rule !== "cap" && p.rule !== "reset" && p.rule !== "fixed") return { ok: false, error: "Pick a fill rule." };
  const color = p.color == null || p.color === "" ? null : p.color;
  if (color !== null && (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color))) return { ok: false, error: "Pick a colour from the list." };
  const target = orNull(p.target);
  const maxPerMonth = orNull(p.maxPerMonth);
  const fixedAmount = orNull(p.fixedAmount);
  const startBalance = orNull(p.startBalance);
  if (target === undefined || maxPerMonth === undefined || fixedAmount === undefined || startBalance === undefined) return { ok: false, error: "Check the amounts: pesos like 1,250.50, no negatives." };

  let tranches: number[] | null = null;
  if (p.rule === "steps") {
    const t = Array.isArray(p.tranches) ? p.tranches : [];
    if (t.length < 1 || t.length > 20 || !t.every((x) => int(x, 1, MAX))) return { ok: false, error: "Enter at least one tranche, like 100,000." };
    tranches = t as number[];
  }
  // A "fill to cap" fund with no target has no cap: it keeps taking what the funds above it leave.
  if (p.rule === "reset" && (target === null || target <= 0)) return { ok: false, error: "Enter the target to fill to." };
  if (p.rule === "cap" && target !== null && target <= 0) return { ok: false, error: "Enter the cap, or leave it empty for no cap." };
  if (p.rule === "fixed" && (fixedAmount === null || fixedAmount <= 0)) return { ok: false, error: "Enter the fixed amount per month." };
  let resetMonth: number | null = null;
  if (p.rule === "reset") {
    resetMonth = p.resetMonth == null ? 1 : (p.resetMonth as number);
    if (!int(resetMonth, 1, 12)) return { ok: false, error: "Pick the month it starts again." };
  }
  const linked = p.linkedAccountId == null || p.linkedAccountId === "" ? null : p.linkedAccountId;
  if (linked !== null && (typeof linked !== "string" || !UUID.test(linked))) return { ok: false, error: "Pick an account from the list." };
  const shareBp = p.shareBp == null ? null : p.shareBp;
  if (shareBp !== null && !int(shareBp, 1, 10_000)) return { ok: false, error: "A share of an account is 1% to 100%." };
  return {
    ok: true,
    value: {
      id: typeof p.id === "string" ? p.id : undefined, name, color: color as string | null, rule: p.rule, target, tranches, maxPerMonth,
      fixedAmount: p.rule === "fixed" ? fixedAmount : null, resetMonth, linkedAccountId: linked as string | null, shareBp: shareBp as number | null,
      startBalance: linked === null ? startBalance : null,
    },
  };
}

/** The server's check of a month override: a new order, pinned amounts and skipped funds, for one or many months. */
export function validateOverride(input: unknown): Checked<OverrideInput> {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Nothing to save." };
  const p = input as Record<string, unknown>;
  const months = Array.isArray(p.months) ? p.months : [];
  if (months.length < 1 || months.length > 60 || !months.every((m) => typeof m === "string" && MONTH.test(m))) return { ok: false, error: "Pick the months to change." };
  const ids = (v: unknown): string[] | null => (Array.isArray(v) && v.length <= 50 && v.every((x) => typeof x === "string" && UUID.test(x)) ? (v as string[]) : null);
  const order = p.order == null ? null : ids(p.order);
  if (p.order != null && order === null) return { ok: false, error: "Check the fund order." };
  const skips = ids(p.skips ?? []);
  if (skips === null) return { ok: false, error: "Check the skipped funds." };
  const pinsIn = p.pins == null ? {} : p.pins;
  if (typeof pinsIn !== "object" || Array.isArray(pinsIn)) return { ok: false, error: "Check the pinned amounts." };
  const pins: Record<string, number> = {};
  for (const [id, v] of Object.entries(pinsIn as Record<string, unknown>)) {
    if (!UUID.test(id) || !int(v, 0, MAX)) return { ok: false, error: "Pinned amounts are pesos like 5,000." };
    pins[id] = v;
  }
  if (skips.some((id) => id in pins)) return { ok: false, error: "A fund is pinned or skipped, not both." };
  const note = typeof p.note === "string" && p.note.trim() !== "" ? p.note.trim().slice(0, 200) : null;
  const overflow = p.overflow == null || p.overflow === "" ? null : p.overflow;
  if (overflow !== null && overflow !== "none" && (typeof overflow !== "string" || !UUID.test(overflow))) return { ok: false, error: "Pick where the extra goes from the list." };
  return { ok: true, value: { months: [...new Set(months as string[])].sort(), order, pins, skips, note, overflow } };
}
