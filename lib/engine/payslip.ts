import type { YearMonth } from "@/lib/domain/dates";
import { findBracket, type TaxRow } from "@/lib/domain/pay";
import { divRound, fromRatio, money, mulBp, sub, sum, ZERO, type Money } from "@/lib/domain/money";
import { philhealthMonthly } from "@/lib/pay/philhealth";
import { TAX_ROWS } from "@/lib/pay/tax-table";
import type { BonusPayment } from "./bonus";
import type { MonthSalary } from "./salary";
import type { PayCutoff, PaySettings } from "./types";

export interface PayslipLineSpec {
  kind: "earning" | "deduction";
  label: string;
  source: "base_share" | "income_tax" | "sss" | "philhealth" | "pagibig" | "custom";
  /** base_share and income_tax: share of the month's base or tax, basis points. */
  shareBp?: number | null;
  /** Replaces the computed amount (and is the amount for `custom`). */
  amountOverride?: Money | null;
}

export interface PayslipTemplate {
  cutoff: PayCutoff;
  /** Applies from this month onward. */
  effectiveMonth: YearMonth;
  lines: PayslipLineSpec[];
}

export interface PayslipLine {
  kind: "earning" | "deduction";
  label: string;
  source: PayslipLineSpec["source"] | "allowance" | "savings_plan" | "other_deduction" | "bonus" | "bonus_tax" | "one_off";
  amount: Money;
}

export interface Payslip {
  cutoff: PayCutoff;
  lines: PayslipLine[];
  earnings: Money;
  deductions: Money;
  takeHome: Money;
}

export interface MonthPay {
  month: YearMonth;
  sss: Money;
  philhealth: Money;
  pagibig: Money;
  /** Income tax for the month, before it is split across the two cutoffs. */
  tax: Money;
  /** The taxable pay behind that tax: regular monthly taxable pay (after contributions) and one-time taxable amounts landing this month. */
  regularTaxable: Money;
  oneTimeTaxable: Money;
  first: Payslip;
  second: Payslip;
  takeHome: Money;
}

/**
 * Default templates (model.md "Payslip builder"): first cutoff = half the base minus half the income tax;
 * second cutoff = half the base minus the other half of the tax, SSS, PhilHealth and Pag-IBIG. Allowances are added on the
 * cutoff each allowance says it lands in (the second by default).
 */
export function defaultTemplate(cutoff: PayCutoff): PayslipTemplate {
  const common: PayslipLineSpec[] = [
    { kind: "earning", label: "Basic pay", source: "base_share", shareBp: 5000 },
    { kind: "deduction", label: "Income tax", source: "income_tax", shareBp: 5000 },
  ];
  const lines: PayslipLineSpec[] =
    cutoff === "first"
      ? common
      : [
          ...common,
          { kind: "deduction", label: "SSS", source: "sss" },
          { kind: "deduction", label: "PhilHealth", source: "philhealth" },
          { kind: "deduction", label: "Pag-IBIG", source: "pagibig" },
        ];
  return { cutoff, effectiveMonth: "0000-01" as YearMonth, lines };
}

export function templateFor(templates: readonly PayslipTemplate[], cutoff: PayCutoff, month: YearMonth): PayslipTemplate {
  const found = templates
    .filter((t) => t.cutoff === cutoff && t.effectiveMonth <= month)
    .sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0];
  return found ?? defaultTemplate(cutoff);
}

/** Tax numerator over 10,000 (annual tax scaled by 10,000) for an annual taxable income. */
function taxScaled(rows: readonly TaxRow[], annualTaxable: Money): bigint {
  const row = findBracket(rows, annualTaxable);
  if (!row) return 0n;
  return BigInt(row.fixed) * 10_000n + (BigInt(annualTaxable) - BigInt(row.lower)) * BigInt(row.rateBp);
}

/**
 * Income tax for one month. Regular taxable pay (base plus monthly taxable allowances, less SSS, PhilHealth and Pag-IBIG) is
 * annualized by 12 and taxed on the bracket table, then divided by 12. One-time taxable amounts (yearly taxable allowances, taxable
 * one-offs) are taxed at the marginal rate on top of the regular year and land in this month. Rounded once.
 */
export function monthlyIncomeTax(rows: readonly TaxRow[], regularMonthlyTaxable: Money, oneTimeTaxable: Money): Money {
  const annual = (regularMonthlyTaxable * 12) as Money;
  const withExtra = (annual + oneTimeTaxable) as Money;
  const numerator = 12n * taxScaled(rows, withExtra) - 11n * taxScaled(rows, annual);
  return fromRatio(numerator, 120_000n);
}

function slip(cutoff: PayCutoff, lines: PayslipLine[]): Payslip {
  const earnings = sum(lines.filter((l) => l.kind === "earning").map((l) => l.amount));
  const deductions = sum(lines.filter((l) => l.kind === "deduction").map((l) => l.amount));
  return { cutoff, lines, earnings, deductions, takeHome: sub(earnings, deductions) };
}

/**
 * The payslips for one month. `bonuses` are the payments landing this month; each adds its gross and its tax to the cutoff its
 * rule names. The engine's figures are placed on the template's lines; take-home = earnings minus deductions on each cutoff.
 */
export function buildMonthPay(
  salary: MonthSalary,
  settings: PaySettings,
  bonuses: readonly BonusPayment[],
  templates: readonly PayslipTemplate[] = [],
  rows: readonly TaxRow[] = TAX_ROWS,
): MonthPay {
  const { base } = salary;
  const sss = settings.sssOverride ?? ZERO;
  const pagibig = settings.pagibigOverride ?? ZERO;
  const philhealth = settings.philhealthOverride ?? philhealthMonthly((base * 12) as Money);
  const mandatory = sum([sss, philhealth, pagibig]);

  const regularTaxable = sub(
    sum([base, ...salary.allowances.filter((a) => a.allowance.taxable && a.allowance.frequency === "monthly").map((a) => a.amount)]),
    mandatory,
  );
  const oneTime = sum([
    ...salary.allowances.filter((a) => a.allowance.taxable && a.allowance.frequency === "yearly").map((a) => a.amount),
    ...salary.oneOffs.filter((o) => o.taxable).map((o) => o.amount),
  ]);
  const tax = monthlyIncomeTax(rows, regularTaxable, oneTime);

  const build = (cutoff: PayCutoff): Payslip => {
    const template = templateFor(templates, cutoff, salary.month);
    const lines: PayslipLine[] = [];
    for (const spec of template.lines) {
      let amount: Money;
      if (spec.amountOverride != null) amount = spec.amountOverride;
      else if (spec.source === "base_share") amount = mulBp(base, spec.shareBp ?? 5000);
      else if (spec.source === "income_tax") amount = taxShare(tax, cutoff, templates, salary.month, spec.shareBp ?? 5000);
      else if (spec.source === "sss") amount = sss;
      else if (spec.source === "philhealth") amount = philhealth;
      else if (spec.source === "pagibig") amount = pagibig;
      else amount = ZERO;
      lines.push({ kind: spec.kind, label: spec.label, source: spec.source, amount });
    }
    // Tax overrides replace the tax line of that cutoff.
    const override = cutoff === "first" ? settings.taxOverrideFirst : settings.taxOverrideSecond;
    if (override !== null) for (const l of lines) if (l.source === "income_tax") l.amount = override;

    for (const a of salary.allowances) {
      if (a.allowance.payslipCutoff === cutoff) lines.push({ kind: "earning", label: a.allowance.name, source: "allowance", amount: a.amount });
    }
    if (cutoff === "second") {
      for (const o of salary.oneOffs) lines.push({ kind: "earning", label: "One-off adjustment", source: "one_off", amount: o.amount });
    }
    if (settings.savingsPlanBp > 0) {
      lines.push({ kind: "deduction", label: "Savings plan", source: "savings_plan", amount: mulBp(divRound(base, 2), settings.savingsPlanBp) });
    }
    if (settings.otherDeduction > 0) lines.push({ kind: "deduction", label: "Other deduction", source: "other_deduction", amount: settings.otherDeduction });
    for (const b of bonuses) {
      if (b.cutoff !== cutoff) continue;
      lines.push({ kind: "earning", label: b.name, source: "bonus", amount: b.gross });
      if (b.tax > 0) lines.push({ kind: "deduction", label: `${b.name} tax`, source: "bonus_tax", amount: b.tax });
    }
    return slip(cutoff, lines);
  };

  const first = build("first");
  const second = build("second");
  return { month: salary.month, sss, philhealth, pagibig, tax, regularTaxable, oneTimeTaxable: oneTime, first, second, takeHome: (first.takeHome + second.takeHome) as Money };
}

/** The first cutoff gets its share rounded; when the two shares add to 100% the second gets the remainder, so the month's tax never leaks a centavo. */
function taxShare(tax: Money, cutoff: PayCutoff, templates: readonly PayslipTemplate[], month: YearMonth, shareBp: number): Money {
  const firstShare = templateFor(templates, "first", month).lines.find((l) => l.source === "income_tax")?.shareBp ?? 5000;
  const secondShare = templateFor(templates, "second", month).lines.find((l) => l.source === "income_tax")?.shareBp ?? 5000;
  const firstTax = mulBp(tax, firstShare);
  if (cutoff === "first") return firstTax;
  return firstShare + secondShare === 10000 ? sub(tax, firstTax) : mulBp(tax, shareBp);
}

export interface BracketStep {
  /** Annual taxable income at the bottom and top of the bracket (null = no top). */
  lower: Money;
  upper: Money | null;
  rateBp: number;
  /** The part of the taxable income that falls in this bracket (zero when it stops lower). */
  amountIn: Money;
  /** Tax on that part at the bracket's rate. The first bracket the income reaches also carries the fixed amount below it. */
  tax: Money;
  /** The bracket the income ends in. */
  hit: boolean;
}

/** The tax working for a month, bracket by bracket: what falls in each bracket and its tax, and the annual total. */
export function taxBreakdown(rows: readonly TaxRow[], annualTaxable: Money): { steps: BracketStep[]; annualTax: Money } {
  const hitRow = findBracket(rows, annualTaxable);
  const steps = rows.map((r) => {
    const top = r.upper === null ? annualTaxable : Math.min(annualTaxable, r.upper);
    const amountIn = money(Math.max(0, top - r.lower));
    return { lower: r.lower, upper: r.upper, rateBp: r.rateBp, amountIn, tax: mulBp(amountIn, r.rateBp), hit: r === hitRow };
  });
  const annualTax = hitRow ? fromRatio(taxScaled(rows, annualTaxable), 10_000n) : ZERO;
  return { steps, annualTax };
}
