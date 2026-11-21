import { money, parsePesos, type Money } from "@/lib/domain/money";

export const ACCOUNT_KINDS = ["ewallet", "debit", "savings", "credit", "cash"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

/** Card colours (the design's flat brand colours). */
export const ACCOUNT_COLORS = [
  "#2F5BD7", "#087A5A", "#B03030", "#7A3FB8", "#0F7A95", "#B83A86", "#4A5568",
  "#1E3A8A", "#0EA5E9", "#14B8A6", "#15803D", "#65A30D", "#CA8A04", "#EA580C",
  "#DC2626", "#9F1239", "#C026D3", "#6D28D9", "#4F46E5", "#78350F", "#334155", "#111827",
] as const;

export interface NewAccount {
  name: string;
  kind: AccountKind;
  institution: string | null;
  /** Last four digits only. Never a full number, expiry, CVV or PIN. */
  last4: string | null;
  color: string;
  creditLimit: Money | null;
  statementDay: number | null;
  dueDay: number | null;
  /** What the account holds now (for a card: what you owe, as a positive number). Becomes the first balance anchor. */
  opening: Money;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX = 100_000_000_000;
const day = (text: string): number | null | undefined => {
  if (text.trim() === "") return null;
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : undefined;
};

/** Validates the add-account form. The database repeats these checks; this gives friendly messages first. */
export function parseNewAccount(input: Readonly<Record<string, string>>): Parsed<NewAccount> {
  const name = (input.name ?? "").trim();
  if (name.length < 1 || name.length > 30) return { ok: false, error: "Give the account a name of up to 30 characters." };
  const kind = input.kind as AccountKind;
  if (!ACCOUNT_KINDS.includes(kind)) return { ok: false, error: "Pick what kind of account it is." };
  const institution = (input.institution ?? "").trim() || null;
  if (institution !== null && institution.length > 40) return { ok: false, error: "The bank or wallet name is too long." };
  const last4 = (input.last4 ?? "").trim() || null;
  if (last4 !== null && !/^[0-9]{4}$/.test(last4)) return { ok: false, error: "Last 4 digits means exactly four digits. Never type a full number." };
  const color = (ACCOUNT_COLORS as readonly string[]).includes(input.color ?? "") ? (input.color as string) : ACCOUNT_COLORS[0];

  const openingText = (input.opening ?? "").trim();
  const opening = openingText === "" ? money(0) : parsePesos(openingText);
  if (opening === undefined || opening < 0 || opening > MAX) return { ok: false, error: "Enter the current amount like 1,250.50, or leave it empty." };

  let creditLimit: Money | null = null;
  let statementDay: number | null = null;
  let dueDay: number | null = null;
  if (kind === "credit") {
    const limitText = (input.creditLimit ?? "").trim();
    if (limitText !== "") {
      const limit = parsePesos(limitText);
      if (limit === undefined || limit <= 0 || limit > MAX) return { ok: false, error: "Enter the credit limit like 50,000." };
      creditLimit = limit;
    }
    const s = day(input.statementDay ?? "");
    const d = day(input.dueDay ?? "");
    if (s === undefined || d === undefined) return { ok: false, error: "Statement and due days are day-of-month numbers from 1 to 31." };
    statementDay = s;
    dueDay = d;
  }
  return { ok: true, value: { name, kind, institution, last4, color, creditLimit, statementDay, dueDay, opening } };
}

/** A card's balance is stored as a position (what you owe is negative). These turn it back into plain words. */
export function creditOwed(balance: Money): Money {
  return money(balance < 0 ? -balance : 0);
}

export function creditAvailable(balance: Money, limit: Money | null): Money | null {
  return limit === null ? null : money(Math.max(0, limit + balance));
}

/** The anchor amount for an opening figure: a card's owed amount is stored as a negative position. */
export function anchorAmount(kind: AccountKind, entered: Money): Money {
  return kind === "credit" ? money(-entered) : entered;
}
