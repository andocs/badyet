export interface SetupLine {
  name: string;
  group: "Essentials" | "Wants" | "Savings";
  rule: "fixed" | "pct";
  /** Which cutoff the line is taken from: "both" takes its amount (or percent) from each cutoff. */
  cutoff: "both" | "first" | "second";
  /** Centavos, for a fixed line. */
  amount: number | null;
  /** Basis points, for a percent line. */
  pctBp: number | null;
}

export interface SetupPayload {
  /** Raw form values, checked by the same validator the Accounts page uses. */
  accounts: Record<string, string>[];
  salary: { base: number; startMonth: string; title: string | null; grade: string | null; sss: number | null; pagibig: number | null } | null;
  paydays: { first: number; second: number } | null;
  lines: SetupLine[] | null;
  funds: { emergency: boolean; travel: boolean } | null;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX = 100_000_000_000;
const int = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
const CUTOFFS = ["both", "first", "second"] as const;
const GROUPS = ["Essentials", "Wants", "Savings"] as const;

/**
 * Paydays: the first cutoff starts the day after the first payday and the second starts on the second payday, so the second payday has to
 * come at least two days after the first, and cutoff start days stay within 2 to 28 (the old columns the database still checks).
 */
export function validatePaydays(first: unknown, second: unknown): Checked<{ first: number; second: number }> {
  if (!int(first, 1, 27) || !int(second, 2, 28)) return { ok: false, error: "Paydays are days of the month: the first from 1 to 27, the second up to 28." };
  if (second < first + 2) return { ok: false, error: "The second payday has to be at least two days after the first." };
  return { ok: true, value: { first, second } };
}

/** The server's check of everything the first-run wizard collects. Every section is optional; a skipped step is null or empty. */
export function validateSetup(input: unknown): Checked<SetupPayload> {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Nothing to save." };
  const p = input as Record<string, unknown>;
  const accounts = Array.isArray(p.accounts) ? p.accounts : [];
  if (accounts.length > 20) return { ok: false, error: "That is a lot of accounts. Add up to 20 now and the rest later." };
  const accountRows: Record<string, string>[] = [];
  const seen = new Set<string>();
  for (const a of accounts) {
    if (typeof a !== "object" || a === null) return { ok: false, error: "Check the accounts." };
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(a as Record<string, unknown>)) if (typeof v === "string") row[k] = v;
    const key = (row.name ?? "").trim().toLowerCase();
    if (key !== "") {
      if (seen.has(key)) return { ok: false, error: `You have two accounts called ${row.name!.trim()}.` };
      seen.add(key);
    }
    accountRows.push(row);
  }

  let salary: SetupPayload["salary"] = null;
  if (p.salary != null) {
    const s = p.salary as Record<string, unknown>;
    if (!int(s.base, 1, MAX)) return { ok: false, error: "Enter your base pay per month, like 58,000." };
    if (typeof s.startMonth !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(s.startMonth)) return { ok: false, error: "Pick the month your pay starts from." };
    const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : null);
    const contrib = (v: unknown): number | null | undefined => (v == null ? null : int(v, 0, MAX) ? v : undefined);
    const sss = contrib(s.sss);
    const pagibig = contrib(s.pagibig);
    if (sss === undefined || pagibig === undefined) return { ok: false, error: "Enter SSS and Pag-IBIG as pesos like 1,750, or leave them empty." };
    salary = { base: s.base, startMonth: s.startMonth, title: text(s.title, 60), grade: text(s.grade, 30), sss, pagibig };
  }

  let paydays: SetupPayload["paydays"] = null;
  if (p.paydays != null) {
    const d = p.paydays as Record<string, unknown>;
    const v = validatePaydays(d.first, d.second);
    if (!v.ok) return v;
    paydays = v.value;
  }

  let lines: SetupPayload["lines"] = null;
  if (p.lines != null) {
    if (!Array.isArray(p.lines) || p.lines.length > 40) return { ok: false, error: "Check the budget lines." };
    lines = [];
    for (const raw of p.lines) {
      const l = raw as Record<string, unknown>;
      const name = typeof l.name === "string" ? l.name.trim() : "";
      if (name.length < 1 || name.length > 60) return { ok: false, error: "Every budget line needs a name of up to 60 characters." };
      if (!(GROUPS as readonly unknown[]).includes(l.group)) return { ok: false, error: "Pick a group for each line." };
      const cutoff = (CUTOFFS as readonly unknown[]).includes(l.cutoff) ? (l.cutoff as SetupLine["cutoff"]) : "both";
      if (lines.some((x) => x.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: `You have two budget lines called ${name}.` };
      if (l.rule === "fixed") {
        if (!int(l.amount, 0, 10_000_000_000)) return { ok: false, error: `Enter an amount for ${name}.` };
        lines.push({ name, group: l.group as SetupLine["group"], rule: "fixed", cutoff, amount: l.amount, pctBp: null });
      } else if (l.rule === "pct") {
        if (!int(l.pctBp, 0, 10_000)) return { ok: false, error: `A percent for ${name} takes 0 to 100%.` };
        lines.push({ name, group: l.group as SetupLine["group"], rule: "pct", cutoff, amount: null, pctBp: l.pctBp });
      } else return { ok: false, error: `Pick a rule for ${name}.` };
    }
    const pct = lines.reduce((t, l) => t + (l.pctBp ?? 0), 0);
    if (pct > 10_000) return { ok: false, error: "The percent lines add up to more than 100% of take-home." };
  }

  let funds: SetupPayload["funds"] = null;
  if (p.funds != null) {
    const f = p.funds as Record<string, unknown>;
    funds = { emergency: f.emergency === true, travel: f.travel === true };
  }
  return { ok: true, value: { accounts: accountRows, salary, paydays, lines, funds } };
}
