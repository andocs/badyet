export interface RaiseAllocationInput {
  lineId: string;
  mode: "amount" | "percent";
  /** Centavos per cutoff the line applies to (mode amount). */
  amount?: number;
  /** Basis points of the extra take-home (mode percent). */
  pctBp?: number;
}

export interface RaisePayload {
  kind: "merit" | "promotion" | "allowance" | "adjustment";
  status: "confirmed" | "expected";
  /** YYYY-MM, the effective month. */
  month: string;
  /** Merit by percent, basis points. */
  pctBp?: number;
  /** Monthly base: merit by amount, or promotion. */
  newBase?: number;
  title?: string;
  grade?: string;
  allowance?: { name: string; amount: number; frequency: "monthly" | "yearly"; payMonth?: number; cutoff: "first" | "second"; taxable: boolean };
  adjustment?: { amount: number; taxable: boolean };
  allocations: RaiseAllocationInput[];
}

export type Valid<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 100_000_000_000;
const isInt = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
const text = (s: unknown, max: number): string | undefined => (typeof s === "string" && s.trim() !== "" ? s.trim().slice(0, max) : undefined);

/**
 * Checks a raise or promotion from the wizard. The browser already worked these numbers out, so this is the server's own check:
 * every figure is range-checked and every id is a UUID. Whether the lines belong to the user is left to row-level security and a lookup.
 */
export function validateRaise(input: unknown): Valid<RaisePayload> {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Nothing to save." };
  const p = input as Record<string, unknown>;
  const kind = p.kind;
  if (kind !== "merit" && kind !== "promotion" && kind !== "allowance" && kind !== "adjustment") return { ok: false, error: "Pick what happened." };
  const status = p.status === "expected" ? "expected" : p.status === "confirmed" ? "confirmed" : null;
  if (!status) return { ok: false, error: "Say whether it has happened or you are expecting it." };
  if (typeof p.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month) || Number(p.month.slice(0, 4)) < 2000 || Number(p.month.slice(0, 4)) > 2100) {
    return { ok: false, error: "Pick the month it starts." };
  }
  const out: RaisePayload = { kind, status, month: p.month, allocations: [] };

  if (kind === "merit") {
    if (p.pctBp !== undefined && p.pctBp !== null) {
      if (!isInt(p.pctBp, 1, 100_000)) return { ok: false, error: "Enter a raise percent above zero." };
      out.pctBp = p.pctBp;
    } else {
      if (!isInt(p.newBase, 1, MAX)) return { ok: false, error: "Enter the new base per month." };
      out.newBase = p.newBase;
    }
  } else if (kind === "promotion") {
    if (!isInt(p.newBase, 1, MAX)) return { ok: false, error: "Enter the new base per month." };
    out.newBase = p.newBase;
    out.title = text(p.title, 60);
    out.grade = text(p.grade, 30);
  } else if (kind === "allowance") {
    const a = p.allowance as Record<string, unknown> | undefined;
    const name = text(a?.name, 60);
    if (!a || !name) return { ok: false, error: "Name the allowance." };
    if (!isInt(a.amount, 1, MAX)) return { ok: false, error: "Enter the allowance amount." };
    if (a.frequency !== "monthly" && a.frequency !== "yearly") return { ok: false, error: "Say how often it is paid." };
    if (a.cutoff !== "first" && a.cutoff !== "second") return { ok: false, error: "Pick the cutoff it lands in." };
    const payMonth = a.frequency === "yearly" ? a.payMonth : undefined;
    if (a.frequency === "yearly" && !isInt(payMonth, 1, 12)) return { ok: false, error: "Pick the month a yearly allowance lands." };
    out.allowance = { name, amount: a.amount, frequency: a.frequency, payMonth: payMonth as number | undefined, cutoff: a.cutoff, taxable: a.taxable === true };
  } else {
    const a = p.adjustment as Record<string, unknown> | undefined;
    if (!a || !isInt(a.amount, -MAX, MAX) || a.amount === 0) return { ok: false, error: "Enter the one-off amount." };
    out.adjustment = { amount: a.amount, taxable: a.taxable === true };
  }

  const allocations = Array.isArray(p.allocations) ? p.allocations : [];
  const seen = new Set<string>();
  for (const raw of allocations) {
    const a = raw as Record<string, unknown>;
    if (typeof a.lineId !== "string" || !UUID.test(a.lineId) || seen.has(a.lineId)) return { ok: false, error: "Each budget line can be used once." };
    seen.add(a.lineId);
    if (a.mode === "amount") {
      if (!isInt(a.amount, 0, MAX)) return { ok: false, error: "Check the amounts for the budget lines." };
      out.allocations.push({ lineId: a.lineId, mode: "amount", amount: a.amount });
    } else if (a.mode === "percent") {
      if (!isInt(a.pctBp, 0, 10_000)) return { ok: false, error: "Percents for the budget lines must be 0 to 100." };
      out.allocations.push({ lineId: a.lineId, mode: "percent", pctBp: a.pctBp });
    } else return { ok: false, error: "Check the budget line entries." };
  }
  if (out.allocations.reduce((t, a) => t + (a.mode === "percent" ? (a.pctBp ?? 0) : 0), 0) > 10_000) return { ok: false, error: "The percents add up to more than the extra." };
  return { ok: true, value: out };
}

export interface TemplateLineInput {
  kind: "earning" | "deduction";
  label: string;
  source: "base_share" | "income_tax" | "sss" | "philhealth" | "pagibig" | "penboost" | "custom";
  shareBp?: number | null;
  amountOverride?: number | null;
}
export interface TemplatesInput {
  month: string;
  first: TemplateLineInput[];
  second: TemplateLineInput[];
}

const SOURCES = ["base_share", "income_tax", "sss", "philhealth", "pagibig", "penboost", "custom"] as const;

/** Checks the payslip layout the builder saves: a month and the lines of both cutoffs. */
export function validateTemplates(input: unknown): Valid<TemplatesInput> {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Nothing to save." };
  const p = input as Record<string, unknown>;
  if (typeof p.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month)) return { ok: false, error: "Pick the month the layout starts." };
  const lines = (raw: unknown): TemplateLineInput[] | null => {
    if (!Array.isArray(raw) || raw.length > 40) return null;
    const out: TemplateLineInput[] = [];
    for (const r of raw) {
      const l = r as Record<string, unknown>;
      const label = text(l.label, 60);
      if (!label || (l.kind !== "earning" && l.kind !== "deduction") || !(SOURCES as readonly unknown[]).includes(l.source)) return null;
      const shareBp = l.shareBp == null ? null : l.shareBp;
      const override = l.amountOverride == null ? null : l.amountOverride;
      if (shareBp !== null && !isInt(shareBp, 0, 10_000)) return null;
      if (override !== null && !isInt(override, 0, MAX)) return null;
      if (l.source === "custom" && override === null) return null;
      out.push({ kind: l.kind, label, source: l.source as TemplateLineInput["source"], shareBp, amountOverride: override });
    }
    return out;
  };
  const first = lines(p.first);
  const second = lines(p.second);
  if (!first || !second) return { ok: false, error: "Check the payslip lines: names, kinds and amounts." };
  return { ok: true, value: { month: p.month, first, second } };
}
