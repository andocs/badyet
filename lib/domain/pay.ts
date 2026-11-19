import type { Money } from './money';
import { ZERO, fromRatio, money, mulBp, sub, sum } from './money';

/** Pay per cutoff (planning doc, F.2). */

export type PayItemKind = 'earning_taxable' | 'earning_nontaxable' | 'deduction' | 'contribution';
export type Cutoff = 'first' | 'second';

export interface PayItem {
  readonly name: string;
  /**
   * deduction: mandatory contributions (SSS, PhilHealth, Pag-IBIG): reduce taxable income.
   * contribution: the payroll Savings Plan: deducted at source, not tax-affecting (D-09).
   */
  readonly kind: PayItemKind;
  readonly amount: Money;
  readonly scope: Cutoff | 'both';
}

/** One row of a bracket table (rule_row). Bracket applies when lower < annual <= upper. */
export interface TaxRow {
  readonly lower: Money;
  /** null means no upper limit. */
  readonly upper: Money | null;
  readonly fixed: Money;
  readonly rateBp: number;
}

export const CUTOFFS_PER_YEAR = 24;

export function findBracket(rows: readonly TaxRow[], annualTaxable: Money): TaxRow | undefined {
  return rows.find(
    (row) => annualTaxable > row.lower && (row.upper === null || annualTaxable <= row.upper),
  );
}

/**
 * Income tax for one cutoff: annual tax on annualized taxable income, divided by 24 and rounded
 * once. The bracket comes from annualized taxable income (DV-01).
 */
export function taxPerCutoff(rows: readonly TaxRow[], annualTaxable: Money): Money {
  const row = findBracket(rows, annualTaxable);
  if (!row) {
    return ZERO;
  }
  // (fixed + (annual - lower) * rate) / 24, with one rounding at the end.
  const numerator =
    BigInt(row.fixed) * 10_000n + (BigInt(annualTaxable) - BigInt(row.lower)) * BigInt(row.rateBp);
  return fromRatio(numerator, 10_000n * BigInt(CUTOFFS_PER_YEAR));
}

export interface CutoffPay {
  readonly taxable: Money;
  readonly nontaxable: Money;
  readonly mandatory: Money;
  readonly tax: Money;
  /** Taxable + nontaxable - mandatory - tax. The figure the sheet budgets on. */
  readonly netBeforePlan: Money;
  /** The payroll Savings Plan deducted at source. */
  readonly plan: Money;
  /** What reaches your account: netBeforePlan - plan. */
  readonly takeHome: Money;
}

export function netCutoff(items: readonly PayItem[], cutoff: Cutoff, taxRows: readonly TaxRow[]): CutoffPay {
  const inScope = items.filter((item) => item.scope === 'both' || item.scope === cutoff);
  const total = (kind: PayItemKind): Money =>
    sum(inScope.filter((item) => item.kind === kind).map((item) => item.amount));
  const taxable = total('earning_taxable');
  const nontaxable = total('earning_nontaxable');
  const mandatory = total('deduction');
  const plan = total('contribution');
  const annualTaxable = money((taxable - mandatory) * CUTOFFS_PER_YEAR);
  const tax = taxPerCutoff(taxRows, annualTaxable);
  const netBeforePlan = sub(sub(money(taxable + nontaxable), mandatory), tax);
  return { taxable, nontaxable, mandatory, tax, netBeforePlan, plan, takeHome: sub(netBeforePlan, plan) };
}

export function netMonth(items: readonly PayItem[], taxRows: readonly TaxRow[]): CutoffPay {
  const a = netCutoff(items, 'first', taxRows);
  const b = netCutoff(items, 'second', taxRows);
  return {
    taxable: money(a.taxable + b.taxable),
    nontaxable: money(a.nontaxable + b.nontaxable),
    mandatory: money(a.mandatory + b.mandatory),
    tax: money(a.tax + b.tax),
    netBeforePlan: money(a.netBeforePlan + b.netBeforePlan),
    plan: money(a.plan + b.plan),
    takeHome: money(a.takeHome + b.takeHome),
  };
}

/** A percentage-of-basic item, rounded once (for example PhilHealth 5% of the semi-monthly basic). */
export function percentOfBasic(basic: Money, rateBp: number): Money {
  return mulBp(basic, rateBp);
}
