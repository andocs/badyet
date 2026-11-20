export interface LineInput {
  id?: string;
  name: string;
  categoryId: string;
  rule: "fixed" | "pct" | "rest";
  /** Centavos, for a fixed line. */
  amount: number | null;
  /** Basis points, for a percent line. */
  pctBp: number | null;
  cutoff: "first" | "second" | "both";
  accountId: string | null;
  /** YYYY-MM or null. */
  startsOn: string | null;
  endsOn: string | null;
  isDraft: boolean;
  countsToDaily: boolean;
  kind: "normal" | "rto" | "rto_contingency";
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const int = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;

/** The server's check of a budget line from the editor. The database repeats the field rules. */
export function validateLine(input: unknown): Checked<LineInput> {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Nothing to save." };
  const p = input as Record<string, unknown>;
  const name = typeof p.name === "string" ? p.name.trim() : "";
  if (name.length < 1 || name.length > 60) return { ok: false, error: "Give the line a name of up to 60 characters." };
  if (typeof p.categoryId !== "string" || !UUID.test(p.categoryId)) return { ok: false, error: "Pick a category." };
  if (p.id !== undefined && p.id !== null && (typeof p.id !== "string" || !UUID.test(p.id))) return { ok: false, error: "That line was not found." };
  if (p.rule !== "fixed" && p.rule !== "pct" && p.rule !== "rest") return { ok: false, error: "Pick a rule." };
  if (p.cutoff !== "first" && p.cutoff !== "second" && p.cutoff !== "both") return { ok: false, error: "Pick the cutoff." };
  if (p.kind !== "normal" && p.kind !== "rto" && p.kind !== "rto_contingency") return { ok: false, error: "Pick what the line counts toward." };
  let amount: number | null = null;
  let pctBp: number | null = null;
  if (p.rule === "fixed") {
    if (!int(p.amount, -10_000_000_000, 10_000_000_000)) return { ok: false, error: "Enter the amount per month, like 1,250.50." };
    amount = p.amount;
  } else if (p.rule === "pct") {
    if (!int(p.pctBp, 0, 10_000)) return { ok: false, error: "A percent line takes 0 to 100%." };
    pctBp = p.pctBp;
  }
  const accountId = p.accountId == null || p.accountId === "" ? null : p.accountId;
  if (accountId !== null && (typeof accountId !== "string" || !UUID.test(accountId))) return { ok: false, error: "Pick an account from the list." };
  const month = (v: unknown): string | null | undefined => (v == null || v === "" ? null : typeof v === "string" && MONTH.test(v) ? v : undefined);
  const startsOn = month(p.startsOn);
  const endsOn = month(p.endsOn);
  if (startsOn === undefined || endsOn === undefined) return { ok: false, error: "Start and end are months like 2027-03." };
  if (startsOn !== null && endsOn !== null && endsOn < startsOn) return { ok: false, error: "The end month is before the start month." };
  if (p.rule === "rest" && p.kind !== "normal") return { ok: false, error: "A Whatever-is-left line cannot be an office-day line." };
  return {
    ok: true,
    value: {
      id: typeof p.id === "string" ? p.id : undefined,
      name,
      categoryId: p.categoryId,
      rule: p.rule,
      amount,
      pctBp,
      cutoff: p.cutoff,
      accountId: accountId as string | null,
      startsOn,
      endsOn,
      isDraft: p.isDraft === true,
      countsToDaily: p.countsToDaily === true,
      kind: p.kind,
    },
  };
}

export interface CategoryInput {
  id?: string;
  name: string;
  groupId: string;
  color: string | null;
}

export function validateCategory(input: unknown): Checked<CategoryInput> {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Nothing to save." };
  const p = input as Record<string, unknown>;
  const name = typeof p.name === "string" ? p.name.trim() : "";
  if (name.length < 1 || name.length > 60) return { ok: false, error: "Give the category a name of up to 60 characters." };
  if (typeof p.groupId !== "string" || !UUID.test(p.groupId)) return { ok: false, error: "Pick a group." };
  if (p.id != null && (typeof p.id !== "string" || !UUID.test(p.id))) return { ok: false, error: "That category was not found." };
  const color = p.color == null || p.color === "" ? null : p.color;
  if (color !== null && (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color))) return { ok: false, error: "Pick a colour from the list." };
  return { ok: true, value: { id: typeof p.id === "string" ? p.id : undefined, name, groupId: p.groupId, color: color as string | null } };
}
