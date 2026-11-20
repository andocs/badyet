import { parsePesos, ZERO, type Money } from "@/lib/domain/money";

export const KINDS = ["ewallet", "debit", "credit"] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_LABEL: Record<Kind, string> = { ewallet: "E-wallet", debit: "Debit account", credit: "Credit card" };
export const isKind = (v: unknown): v is Kind => typeof v === "string" && (KINDS as readonly string[]).includes(v);

export interface AccountInput {
  kind: Kind;
  name: string;
  institution: string | null;
  last4: string | null;
  balance: Money;
  creditLimit: Money | null;
  statementDay: number | null;
  dueDay: number | null;
}
export type AccountParse = { ok: true; value: AccountInput } | { ok: false; error: string };

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const MAX = 100_000_000_000;

function day(v: string): number | null | "bad" {
  if (v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : "bad";
}

// Only the last 4 digits are ever accepted. Anything longer is refused (not trimmed), so a full card or account number
// pasted by mistake is never stored, not even partly.
export function parseLast4(raw: string): { ok: true; value: string | null } | { ok: false } {
  const v = raw.replace(/[\s-]/g, "");
  if (v === "") return { ok: true, value: null };
  return /^\d{4}$/.test(v) ? { ok: true, value: v } : { ok: false };
}

export function parseAccountForm(raw: Record<string, unknown>): AccountParse {
  const kind = text(raw.kind);
  if (!isKind(kind)) return { ok: false, error: "Pick what kind of account this is." };
  const name = text(raw.name);
  if (name.length < 1 || name.length > 30) return { ok: false, error: "Give it a name (1 to 30 characters)." };
  const institution = text(raw.institution);
  if (institution.length > 40) return { ok: false, error: "The bank or provider name is too long (40 characters at most)." };
  const last4 = parseLast4(text(raw.last4));
  if (!last4.ok) return { ok: false, error: "Enter only the last 4 digits. Never type or paste the full number here." };
  const balText = text(raw.balance);
  const balance = balText === "" ? ZERO : parsePesos(balText);
  if (balance === undefined || balance < 0 || balance > MAX) {
    return { ok: false, error: kind === "credit" ? "Enter what you owe as an amount like 4,500.00." : "Enter the balance as an amount like 12,345.67." };
  }
  let creditLimit: Money | null = null;
  let statementDay: number | null = null;
  let dueDay: number | null = null;
  if (kind === "credit") {
    const limText = text(raw.creditLimit);
    if (limText !== "") {
      const lim = parsePesos(limText);
      if (lim === undefined || lim <= 0 || lim > MAX) return { ok: false, error: "Enter the credit limit as an amount like 50,000." };
      creditLimit = lim;
    }
    const s = day(text(raw.statementDay));
    const d = day(text(raw.dueDay));
    if (s === "bad" || d === "bad") return { ok: false, error: "Statement and due days must be a whole day from 1 to 31." };
    statementDay = s;
    dueDay = d;
  }
  return { ok: true, value: { kind, name, institution: institution === "" ? null : institution, last4: last4.value, balance, creditLimit, statementDay, dueDay } };
}
