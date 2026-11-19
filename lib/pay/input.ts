import { parsePesos, type Money } from "@/lib/domain/money";
import type { PayProfile } from "./compute";

export type PayInput = Record<string, unknown>;
export type PayParse = { ok: true; value: PayProfile } | { ok: false; error: string };

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const MAX = 10_000_000_000; // 100 million pesos in centavos: far above any real salary, blocks typos

function peso(v: unknown, label: string, opts: { required?: boolean; positive?: boolean } = {}): Money | null | string {
  const t = text(v);
  if (t === "") return opts.required ? `${label} is required.` : null;
  const m = parsePesos(t);
  if (m === undefined || m < 0 || m > MAX) return `${label} must be an amount like 1,234.50.`;
  if (opts.positive && m === 0) return `${label} must be more than zero.`;
  return m;
}

// Percent with up to 2 decimals, 0 to 100, returned in basis points.
function percentBp(v: unknown): number | string {
  const t = text(v);
  if (t === "") return 0;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return "Savings plan must be a percent like 6 or 6.5.";
  const bp = Math.round(Number(t) * 100);
  return bp > 10_000 ? "Savings plan cannot be more than 100%." : bp;
}

export function parsePayForm(raw: PayInput): PayParse {
  const annualBase = peso(raw.annualBase, "Annual base", { required: true, positive: true });
  const allowanceSecond = peso(raw.allowanceSecond, "Allowance");
  const sss = peso(raw.sss, "SSS");
  const pagibig = peso(raw.pagibig, "Pag-IBIG");
  const philhealthOverride = peso(raw.philhealthOverride, "PhilHealth override");
  const taxOverrideFirst = peso(raw.taxOverrideFirst, "First cutoff tax override");
  const taxOverrideSecond = peso(raw.taxOverrideSecond, "Second cutoff tax override");
  const savingsPlanBp = percentBp(raw.savingsPlanPercent);

  const checked = [annualBase, allowanceSecond, sss, pagibig, philhealthOverride, taxOverrideFirst, taxOverrideSecond, savingsPlanBp];
  const bad = checked.find((c) => typeof c === "string");
  if (typeof bad === "string") return { ok: false, error: bad };

  return {
    ok: true,
    value: {
      annualBase: annualBase as Money,
      allowanceSecond: (allowanceSecond ?? 0) as Money,
      sss: (sss ?? 0) as Money,
      pagibig: (pagibig ?? 0) as Money,
      savingsPlanBp: savingsPlanBp as number,
      philhealthOverride: philhealthOverride as Money | null,
      taxOverrideFirst: taxOverrideFirst as Money | null,
      taxOverrideSecond: taxOverrideSecond as Money | null,
    },
  };
}
