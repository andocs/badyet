import type { YearMonth } from "@/lib/domain/dates";
import { findBracket, taxPerCutoff, type TaxRow } from "@/lib/domain/pay";
import { divRound, fromRatio, money, mulBp, sub, sum, ZERO, type Money } from "@/lib/domain/money";
import { pagibigEmployee, sssMpf, sssRegular } from "@/lib/pay/contributions";
import { philhealthMonthly } from "@/lib/pay/philhealth";
import { TAX_ROWS } from "@/lib/pay/tax-table";
import type { BonusPayment } from "./bonus";
import type { MonthSalary } from "./salary";
import type { PayCutoff, PaySettings } from "./types";

export interface PayslipLineSpec {
  kind: "earning" | "deduction";
  label: string;
  source: "base_share" | "income_tax" | "sss" | "philhealth" | "pagibig" | "penboost" | "custom";
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
  source: PayslipLineSpec["source"] | "allowance" | "savings_plan" | "other_deduction" | "bonus" | "de_minimis" | "one_off";
  amount: Money;
  /** An other deduction set to show under a budget category: that category group's id. */
  ref?: string;
  /** The amount was changed for this month only. */
  edited?: boolean;
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
  /** Income tax for the month: the two cutoffs' own tax added together. */
  tax: Money;
  /** The taxable pay behind that tax: regular monthly taxable pay (after contributions) and one-time taxable amounts landing this month. */
  regularTaxable: Money;
  oneTimeTaxable: Money;
  taxFirst: Money;
  taxSecond: Money;
  /** Each cutoff's taxable pay (after the contributions taken in it); the tax is worked on this x 24. */
  taxableFirst: Money;
  taxableSecond: Money;
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
          { kind: "deduction", label: "SSS PenBoost", source: "penboost" },
        ];
  return { cutoff, effectiveMonth: "0000-01" as YearMonth, lines };
}

const latest = (templates: readonly PayslipTemplate[], cutoff: PayCutoff, month: YearMonth) =>
  templates
    .filter((t) => t.cutoff === cutoff && t.effectiveMonth <= month)
    .sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0];

/**
 * The template in force for a cutoff. A template saved before SSS PenBoost existed has no line for it on either cutoff, so the
 * second cutoff gets one at zero, ready for the amount to be typed on it.
 */
/** What the payroll savings plan takes each cutoff: a fixed amount if one is set, otherwise a percent of half the monthly basic. */
export function savingsPlanPerCutoff(settings: Pick<PaySettings, "savingsPlanBp" | "savingsPlanAmount">, base: Money): Money {
  if (settings.savingsPlanAmount != null && settings.savingsPlanAmount > 0) return settings.savingsPlanAmount;
  return settings.savingsPlanBp > 0 ? mulBp(divRound(base, 2), settings.savingsPlanBp) : ZERO;
}

export function templateFor(templates: readonly PayslipTemplate[], cutoff: PayCutoff, month: YearMonth): PayslipTemplate {
  const found = latest(templates, cutoff, month);
  if (!found) return defaultTemplate(cutoff);
  if (cutoff === "second") {
    const first = latest(templates, "first", month) ?? defaultTemplate("first");
    const has = (t: PayslipTemplate) => t.lines.some((l) => l.source === "penboost");
    if (!has(found) && !has(first)) return { ...found, lines: [...found.lines, { kind: "deduction", label: "SSS PenBoost", source: "penboost" }] };
  }
  return found;
}

/** Tax numerator over 10,000 (annual tax scaled by 10,000) for an annual taxable income. */
function taxScaled(rows: readonly TaxRow[], annualTaxable: Money): bigint {
  const row = findBracket(rows, annualTaxable);
  if (!row) return 0n;
  return BigInt(row.fixed) * 10_000n + (BigInt(annualTaxable) - BigInt(row.lower)) * BigInt(row.rateBp);
}

/**
 * Income tax for one cutoff, the way the payslip works it: the cutoff's taxable pay (after the contributions taken in that cutoff)
 * is annualized by 24, found on the bracket table, and the yearly tax is divided by 24. Rounded once.
 */
export function cutoffIncomeTax(rows: readonly TaxRow[], cutoffTaxable: Money): Money {
  return cutoffTaxable <= 0 ? ZERO : taxPerCutoff(rows, money(cutoffTaxable * 24));
}

/**
 * Extra tax on one-time taxable amounts (yearly taxable allowances, taxable one-offs): taxed at the marginal rate on top of the
 * regular year (regular monthly taxable x 12) and landing in the month they are paid.
 */
export function oneTimeIncomeTax(rows: readonly TaxRow[], regularMonthlyTaxable: Money, oneTimeTaxable: Money): Money {
  if (oneTimeTaxable <= 0) return ZERO;
  const annual = money(Math.max(0, regularMonthlyTaxable) * 12);
  const withExtra = money(annual + oneTimeTaxable);
  return fromRatio(taxScaled(rows, withExtra) - taxScaled(rows, annual), 10_000n);
}

function slip(cutoff: PayCutoff, lines: PayslipLine[]): Payslip {
  const earnings = sum(lines.filter((l) => l.kind === "earning").map((l) => l.amount));
  const deductions = sum(lines.filter((l) => l.kind === "deduction").map((l) => l.amount));
  return { cutoff, lines, earnings, deductions, takeHome: sub(earnings, deductions) };
}

/**
 * The payslips for one month. `bonuses` are the payments landing this month; each adds its gross to the cutoff its rule names,
 * and its taxable part to that cutoff's taxable pay, so its tax is in that cutoff's income tax line. The engine's figures are placed on the template's lines; take-home = earnings minus deductions on each cutoff.
 */
export function buildMonthPay(
  salary: MonthSalary,
  settings: PaySettings,
  bonuses: readonly BonusPayment[],
  templates: readonly PayslipTemplate[] = [],
  rows: readonly TaxRow[] = TAX_ROWS,
): MonthPay {
  const { base } = salary;
  // The SSS table splits your share in two: regular SS is the SSS line, and the MPF part is the SSS PenBoost line.
  const sss = settings.sssOverride ?? sssRegular(base);
  const penboost = sssMpf(base);
  const pagibig = settings.pagibigOverride ?? pagibigEmployee(base);
  const philhealth = settings.philhealthOverride ?? philhealthMonthly((base * 12) as Money);

  // "This month only" changes, which win over the layout's typed amounts and over a tax amount set for every month.
  const edits = (settings.monthEdits ?? []).filter((e) => e.month === salary.month);
  const editFor = (cutoff: PayCutoff, spec: PayslipLineSpec) =>
    spec.source === "base_share" ? undefined : edits.find((e) => e.cutoff === cutoff && e.source === spec.source && (spec.source !== "custom" || e.label === spec.label));

  // Tax is worked per cutoff on that cutoff's taxable pay. Contributions that reduce it are the SSS, PhilHealth, Pag-IBIG and
  // PenBoost lines on that cutoff's payslip, at the amount on the line (a typed amount counts, as it does on the payslip).
  const sourceAmount: Record<string, Money> = { sss, philhealth, pagibig, penboost };
  const mandatoryIn = (cutoff: PayCutoff): Money =>
    sum(
      templateFor(templates, cutoff, salary.month)
        .lines.filter((l) => l.kind === "deduction" && l.source in sourceAmount)
        .map((l) => {
          const e = editFor(cutoff, l);
          return e ? (e.amount ?? sourceAmount[l.source]!) : (l.amountOverride ?? sourceAmount[l.source]!);
        }),
    );
  const baseIn = (cutoff: PayCutoff): Money =>
    mulBp(base, templateFor(templates, cutoff, salary.month).lines.find((l) => l.source === "base_share")?.shareBp ?? 5000);
  const taxableIn = (cutoff: PayCutoff): Money =>
    sub(
      sum([
        baseIn(cutoff),
        ...salary.allowances
          .filter((a) => a.allowance.taxable && a.allowance.frequency === "monthly" && a.allowance.payslipCutoff === cutoff)
          .map((a) => a.amount),
      ]),
      mandatoryIn(cutoff),
    );

  // A bonus's taxable part (after its de minimis and the yearly tax-free cap) joins the taxable pay of the cutoff it lands in.
  const bonusTaxableIn = (cutoff: PayCutoff): Money =>
    sum(bonuses.filter((b) => b.cutoff === cutoff).map((b) => money(Math.max(0, b.gross - b.deMinimis - b.exempt))));
  const regularFirst = taxableIn("first");
  const regularSecond = taxableIn("second");
  const regularTaxable = (regularFirst + regularSecond) as Money;
  const taxableFirst = (regularFirst + bonusTaxableIn("first")) as Money;
  const taxableSecond = (regularSecond + bonusTaxableIn("second")) as Money;
  const oneTime = sum([
    ...salary.allowances.filter((a) => a.allowance.taxable && a.allowance.frequency === "yearly").map((a) => a.amount),
    ...salary.oneOffs.filter((o) => o.taxable).map((o) => o.amount),
  ]);
  const taxFirst = cutoffIncomeTax(rows, taxableFirst);
  // The one-time tax lands in the second cutoff, with the one-offs.
  const taxSecond = (cutoffIncomeTax(rows, taxableSecond) + oneTimeIncomeTax(rows, regularTaxable, oneTime)) as Money;
  const tax = (taxFirst + taxSecond) as Money;

  const build = (cutoff: PayCutoff): Payslip => {
    const template = templateFor(templates, cutoff, salary.month);
    const lines: PayslipLine[] = [];
    for (const spec of template.lines) {
      let amount: Money;
      if (spec.amountOverride != null) amount = spec.amountOverride;
      else if (spec.source === "base_share") amount = mulBp(base, spec.shareBp ?? 5000);
      else if (spec.source === "income_tax") amount = cutoff === "first" ? taxFirst : taxSecond;
      else if (spec.source === "sss") amount = sss;
      else if (spec.source === "philhealth") amount = philhealth;
      else if (spec.source === "pagibig") amount = pagibig;
      else if (spec.source === "penboost") amount = penboost;
      else amount = ZERO;
      lines.push({ kind: spec.kind, label: spec.label, source: spec.source, amount });
    }
    // Tax overrides replace the tax line of that cutoff.
    const override = cutoff === "first" ? settings.taxOverrideFirst : settings.taxOverrideSecond;
    if (override !== null) for (const l of lines) if (l.source === "income_tax") l.amount = override;
    // The template lines are first in `lines`, in the template's order.
    template.lines.forEach((spec, i) => {
      const e = editFor(cutoff, spec);
      if (!e) return;
      const calculated = spec.source === "income_tax" ? (override ?? (cutoff === "first" ? taxFirst : taxSecond)) : spec.source === "custom" ? (spec.amountOverride ?? ZERO) : sourceAmount[spec.source]!;
      lines[i] = { ...lines[i]!, amount: e.amount ?? calculated, edited: true };
    });

    for (const a of salary.allowances) {
      if (a.allowance.payslipCutoff === cutoff) lines.push({ kind: "earning", label: a.allowance.name, source: "allowance", amount: a.amount });
    }
    if (cutoff === "second") {
      for (const o of salary.oneOffs) lines.push({ kind: "earning", label: "One-off adjustment", source: "one_off", amount: o.amount });
    }
    const plan = savingsPlanPerCutoff(settings, base);
    if (plan > 0) lines.push({ kind: "deduction", label: "Savings plan", source: "savings_plan", amount: plan });
    const others = settings.otherDeductions ?? [];
    if (others.length > 0) {
      for (const o of others) {
        const amount = o.cutoff === "both" ? (cutoff === "second" ? (o.amountSecond ?? o.amount) : o.amount) : o.cutoff === cutoff ? o.amount : ZERO;
        if (amount > 0) lines.push({ kind: "deduction", label: o.label.trim() || "Other deduction", source: "other_deduction", amount, ...(o.groupId ? { ref: o.groupId } : {}) });
      }
    } else if (settings.otherDeduction > 0) lines.push({ kind: "deduction", label: settings.otherDeductionLabel?.trim() || "Other deduction", source: "other_deduction", amount: settings.otherDeduction });
    for (const b of bonuses) {
      if (b.cutoff !== cutoff) continue;
      // Its tax is inside this cutoff's income tax line. De minimis gets its own line, since it is never taxed.
      lines.push({ kind: "earning", label: b.name, source: "bonus", amount: sub(b.gross, b.deMinimis) });
      if (b.deMinimis > 0) lines.push({ kind: "earning", label: `${b.name} de minimis`, source: "de_minimis", amount: b.deMinimis });
    }
    return slip(cutoff, lines);
  };

  const first = build("first");
  const second = build("second");
  return { month: salary.month, sss, philhealth, pagibig, tax, taxFirst, taxSecond, taxableFirst, taxableSecond, regularTaxable, oneTimeTaxable: oneTime, first, second, takeHome: (first.takeHome + second.takeHome) as Money };
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
