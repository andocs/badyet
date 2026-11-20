export interface RuleInput {
  id?: string;
  name: string;
  recurrence: "yearly" | "once";
  kind: "thirteenth" | "cip" | "custom" | "oneoff";
  payMonth: number;
  /** YYYY-MM, for a one-off. */
  onceOn: string | null;
  cutoff: "first" | "second";
  formula: "base_multiple" | "eligible_x_component_x_multiplier" | "fixed";
  baseMultipleBp: number | null;
  eligibleAmount: number | null;
  componentNum: number | null;
  fixedAmount: number | null;
  deMinimis: number;
}

export interface SplitInput {
  kind: "fund" | "gift" | "purchase" | "debt" | "wants" | "account";
  targetId: string | null;
  label: string | null;
  amount: number;
  done: boolean;
}

export interface InstanceInput {
  ruleId: string;
  year: number;
  /** The Low/Base/High pick for CIP, hundredths. */
  multiplierNum: number | null;
  splits: SplitInput[];
  /** Set when the bonus has been paid: what actually arrived, in centavos. */
  received: { gross: number; deMinimis: number; net: number } | null;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 100_000_000_000;
const int = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;

/** The server's check of a bonus rule from the editor. */
export function validateRule(input: unknown): Checked<RuleInput> {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Nothing to save." };
  const p = input as Record<string, unknown>;
  const name = typeof p.name === "string" ? p.name.trim() : "";
  if (name.length < 1 || name.length > 60) return { ok: false, error: "Give the bonus a name of up to 60 characters." };
  if (p.id != null && (typeof p.id !== "string" || !UUID.test(p.id))) return { ok: false, error: "That bonus was not found." };
  if (p.recurrence !== "yearly" && p.recurrence !== "once") return { ok: false, error: "Say whether it repeats every year or is a one-off." };
  if (p.kind !== "thirteenth" && p.kind !== "cip" && p.kind !== "custom" && p.kind !== "oneoff") return { ok: false, error: "Pick the kind of bonus." };
  if (p.cutoff !== "first" && p.cutoff !== "second") return { ok: false, error: "Pick the cutoff it lands in." };
  if (p.formula !== "base_multiple" && p.formula !== "eligible_x_component_x_multiplier" && p.formula !== "fixed") return { ok: false, error: "Pick how it is worked out." };
  let onceOn: string | null = null;
  let payMonth = p.payMonth;
  if (p.recurrence === "once") {
    if (typeof p.onceOn !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.onceOn)) return { ok: false, error: "Pick the month a one-off lands." };
    onceOn = p.onceOn;
    payMonth = Number(p.onceOn.slice(5));
  }
  if (!int(payMonth, 1, 12)) return { ok: false, error: "Pick the month it lands." };
  if (p.kind === "thirteenth" && p.recurrence !== "yearly") return { ok: false, error: "The 13th month repeats every year." };

  let baseMultipleBp: number | null = null;
  let eligibleAmount: number | null = null;
  let componentNum: number | null = null;
  let fixedAmount: number | null = null;
  if (p.formula === "base_multiple") {
    if (!int(p.baseMultipleBp, 1, 1_000_000)) return { ok: false, error: "Enter how many months of base pay, like 1." };
    baseMultipleBp = p.baseMultipleBp;
  } else if (p.formula === "fixed") {
    if (!int(p.fixedAmount, 1, MAX)) return { ok: false, error: "Enter the amount." };
    fixedAmount = p.fixedAmount;
  } else {
    if (!int(p.eligibleAmount, 1, MAX)) return { ok: false, error: "Enter the eligible earnings." };
    if (!int(p.componentNum, 1, 100_000_000)) return { ok: false, error: "Enter your individual component, like 13.81505%." };
    eligibleAmount = p.eligibleAmount;
    componentNum = p.componentNum;
  }
  const deMinimis = p.deMinimis == null ? 0 : p.deMinimis;
  if (!int(deMinimis, 0, MAX)) return { ok: false, error: "Enter the de minimis amount, or 0." };
  if (p.kind === "thirteenth" && deMinimis !== 0) return { ok: false, error: "The 13th month has no de minimis." };
  return {
    ok: true,
    value: {
      id: typeof p.id === "string" ? p.id : undefined,
      name,
      recurrence: p.recurrence,
      kind: p.kind,
      payMonth: payMonth as number,
      onceOn,
      cutoff: p.cutoff,
      formula: p.formula,
      baseMultipleBp,
      eligibleAmount,
      componentNum,
      fixedAmount,
      deMinimis,
    },
  };
}

/** The server's check of one year's choices for a bonus: the multiplier pick, where it goes, and (when paid) what arrived. */
export function validateInstance(input: unknown): Checked<InstanceInput> {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Nothing to save." };
  const p = input as Record<string, unknown>;
  if (typeof p.ruleId !== "string" || !UUID.test(p.ruleId)) return { ok: false, error: "That bonus was not found." };
  if (!int(p.year, 2000, 2200)) return { ok: false, error: "Pick a year." };
  if (p.multiplierNum != null && !int(p.multiplierNum, 1, 1_000)) return { ok: false, error: "Check the multiplier." };
  const raw = Array.isArray(p.splits) ? p.splits : [];
  if (raw.length > 30) return { ok: false, error: "That is too many destinations." };
  const splits: SplitInput[] = [];
  for (const r of raw) {
    const s = r as Record<string, unknown>;
    if (s.kind !== "fund" && s.kind !== "gift" && s.kind !== "purchase" && s.kind !== "debt" && s.kind !== "wants" && s.kind !== "account") return { ok: false, error: "Check the destination types." };
    if (s.targetId != null && (typeof s.targetId !== "string" || !UUID.test(s.targetId))) return { ok: false, error: "Pick a fund from the list." };
    if (s.kind === "fund" && s.targetId == null) return { ok: false, error: "Pick a fund from the list." };
    const label = typeof s.label === "string" && s.label.trim() !== "" ? s.label.trim().slice(0, 60) : null;
    if (s.kind !== "fund" && label === null) return { ok: false, error: "Name each destination." };
    if (!int(s.amount, 0, MAX)) return { ok: false, error: "Check the destination amounts." };
    splits.push({ kind: s.kind, targetId: (s.targetId as string | null) ?? null, label, amount: s.amount, done: s.done === true });
  }
  let received: InstanceInput["received"] = null;
  if (p.received != null) {
    const r = p.received as Record<string, unknown>;
    if (!int(r.gross, 0, MAX) || !int(r.deMinimis, 0, MAX) || !int(r.net, 0, MAX)) return { ok: false, error: "Enter what arrived: gross, de minimis and net." };
    if ((r.deMinimis as number) > (r.gross as number) || (r.net as number) > (r.gross as number)) return { ok: false, error: "De minimis and net cannot be more than the gross." };
    received = { gross: r.gross as number, deMinimis: r.deMinimis as number, net: r.net as number };
  }
  return { ok: true, value: { ruleId: p.ruleId, year: p.year, multiplierNum: (p.multiplierNum as number | null | undefined) ?? null, splits, received } };
}
