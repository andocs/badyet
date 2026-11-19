import { divRound, money, sub, type Money } from "@/lib/domain/money";
import { CUTOFFS_PER_YEAR, netCutoff, percentOfBasic, type CutoffPay, type PayItem } from "@/lib/domain/pay";
import { PHILHEALTH_BP, TAX_ROWS } from "./tax-table";

export interface PayProfile {
  /** Annual base salary. Basic per cutoff = annual / 24. */
  annualBase: Money;
  /** Non-taxable allowance paid in the second cutoff. */
  allowanceSecond: Money;
  /** Mandatory contributions are taken in the second cutoff (as the old sheet did). */
  sss: Money;
  pagibig: Money;
  /** Payroll savings plan, percent of basic in basis points (600 = 6%). Not tax-affecting. */
  savingsPlanBp: number;
  /** Per-line overrides; null means "use the calculated value". */
  philhealthOverride: Money | null;
  taxOverrideFirst: Money | null;
  taxOverrideSecond: Money | null;
}

export interface PayResult {
  basicPerCutoff: Money;
  philhealth: Money;
  first: CutoffPay;
  second: CutoffPay;
  month: CutoffPay;
}

function withTax(pay: CutoffPay, tax: Money | null): CutoffPay {
  if (tax === null) return pay;
  const netBeforePlan = sub(sub(money(pay.taxable + pay.nontaxable), pay.mandatory), tax);
  return { ...pay, tax, netBeforePlan, takeHome: sub(netBeforePlan, pay.plan) };
}

/** The regular pay items for a profile (basic, allowance, contributions, savings plan). */
export function buildItems(profile: PayProfile): { items: PayItem[]; basic: Money; philhealth: Money } {
  const basic = divRound(profile.annualBase, CUTOFFS_PER_YEAR);
  const philhealth = profile.philhealthOverride ?? percentOfBasic(basic, PHILHEALTH_BP);
  const items: PayItem[] = [
    { name: "Basic pay", kind: "earning_taxable", amount: basic, scope: "both" },
    { name: "Allowance", kind: "earning_nontaxable", amount: profile.allowanceSecond, scope: "second" },
    { name: "SSS", kind: "deduction", amount: profile.sss, scope: "second" },
    { name: "PhilHealth", kind: "deduction", amount: philhealth, scope: "second" },
    { name: "Pag-IBIG", kind: "deduction", amount: profile.pagibig, scope: "second" },
    { name: "Savings plan", kind: "contribution", amount: percentOfBasic(basic, profile.savingsPlanBp), scope: "both" },
  ];
  return { items, basic, philhealth };
}

export function computePay(profile: PayProfile): PayResult {
  const { items, basic, philhealth } = buildItems(profile);
  const first = withTax(netCutoff(items, "first", TAX_ROWS), profile.taxOverrideFirst);
  const second = withTax(netCutoff(items, "second", TAX_ROWS), profile.taxOverrideSecond);
  const month: CutoffPay = {
    taxable: money(first.taxable + second.taxable),
    nontaxable: money(first.nontaxable + second.nontaxable),
    mandatory: money(first.mandatory + second.mandatory),
    tax: money(first.tax + second.tax),
    netBeforePlan: money(first.netBeforePlan + second.netBeforePlan),
    plan: money(first.plan + second.plan),
    takeHome: money(first.takeHome + second.takeHome),
  };
  return { basicPerCutoff: basic, philhealth, first, second, month };
}
