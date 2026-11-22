import type { YearMonth } from "@/lib/domain/dates";
import type { Money } from "@/lib/domain/money";

/**
 * Inputs for the rehaul engine (slice 1). These mirror the new tables in docs/rehaul/model.md, with months as
 * YearMonth ("2027-03") and money in centavos. Loading rows into these shapes is a later slice; nothing here touches the database.
 */

export type PayCutoff = "first" | "second";

export interface SalaryEvent {
  id: string;
  effectiveMonth: YearMonth;
  kind: "start" | "merit" | "promotion" | "allowance" | "adjustment";
  /** Merit by percent, basis points (500 = 5%). */
  pctBp?: number | null;
  /** Monthly base: start, promotion, or merit by amount. */
  newBase?: Money | null;
  /** An allowance change points at the allowance row. */
  allowanceId?: string | null;
  /** One month only (adjustment). */
  oneOffAmount?: Money | null;
  oneOffTaxable?: boolean;
  status: "confirmed" | "expected";
}

export interface Allowance {
  id: string;
  payslipCutoff: PayCutoff;
  name: string;
  amount: Money;
  frequency: "monthly" | "yearly";
  /** 1 to 12; the month a yearly allowance lands. */
  payMonth?: number | null;
  taxable: boolean;
  startsOn: YearMonth;
  endsOn?: YearMonth | null;
}

export interface Assumptions {
  /** Hundredths: 125 = 1.25. Used by CIP when an instance has no pick of its own. */
  cipMultiplierNum: number;
  assumedRaiseOn: boolean;
  assumedRaiseBp: number;
  /** 1 to 12. */
  assumedRaiseMonth: number;
}

/** Payroll settings. null means "standard rate" (PhilHealth) or "none" (SSS and Pag-IBIG are typed by the user). */
export interface PaySettings {
  sssOverride: Money | null;
  philhealthOverride: Money | null;
  pagibigOverride: Money | null;
  taxOverrideFirst: Money | null;
  taxOverrideSecond: Money | null;
  /** Taken from every cutoff after tax (HMO and the like). */
  otherDeduction: Money;
  /** Payroll savings plan, percent of basic per cutoff, basis points. */
  savingsPlanBp: number;
}

export interface BonusSplit {
  targetKind: "fund" | "gift" | "purchase" | "debt" | "wants" | "account";
  targetId?: string | null;
  label?: string | null;
  mode: "amount" | "percent";
  amount?: Money | null;
  pctBp?: number | null;
}

export interface BonusRule {
  id: string;
  payslipCutoff: PayCutoff;
  recurrence: "yearly" | "once";
  kind: "thirteenth" | "cip" | "custom" | "oneoff";
  name: string;
  /** 1 to 12. */
  payMonth: number;
  /** For `once`: the month it lands. */
  onceOn?: YearMonth | null;
  formula: "base_multiple" | "eligible_x_component_x_multiplier" | "fixed";
  /** 10000 = one month of basic pay. */
  baseMultipleBp?: number | null;
  /** CIP: eligible earnings as typed for `eligibleRefYear`. */
  eligibleAmount?: Money | null;
  /** The year the eligible figure was typed for; later years scale with base pay. */
  eligibleRefYear?: number | null;
  /** Over 10,000,000. */
  componentNum?: number | null;
  fixedAmount?: Money | null;
  deMinimis: Money;
  /** Defaults for the forecast; an instance can override. */
  splits: BonusSplit[];
}

export interface BonusInstance {
  ruleId: string;
  year: number;
  /** The Low/Base/High pick for CIP, hundredths. */
  multiplierNum?: number | null;
  status: "planned" | "received";
  grossActual?: Money | null;
  deMinimisActual?: Money | null;
  netActual?: Money | null;
  /** When set, replaces the rule's default splits for this year. */
  splits?: BonusSplit[] | null;
}

export type LineRule = "fixed" | "pct" | "rest";

export interface BudgetLine {
  id: string;
  name: string;
  rule: LineRule;
  amount?: Money | null;
  /** A fixed line on both cutoffs: what the second cutoff takes, when it differs from `amount` (the first cutoff's). */
  amountSecond?: Money | null;
  pctBp?: number | null;
  cutoff: PayCutoff | "both";
  /** Money that comes back to this line each month, deposited in one cutoff. It adds to what that cutoff has to spend. */
  reimburse?: { amount: Money; cutoff: PayCutoff; day?: number | null } | null;
  startsOn?: YearMonth | null;
  endsOn?: YearMonth | null;
  isDraft?: boolean;
  /** Group of the line's category; lines in groups that feed savings fill the pool. */
  feedsSavings: boolean;
  countsToDaily: boolean;
  kind: "normal" | "rto" | "rto_contingency";
}

export interface RaiseAllocation {
  salaryEventId: string;
  budgetLineId: string;
  mode: "amount" | "percent";
  amount?: Money | null;
  pctBp?: number | null;
}

export interface Fund {
  id: string;
  name: string;
  /** 1 = first. */
  priority: number;
  rule: "steps" | "cap" | "reset" | "fixed";
  /** Cap, or the hard cap for steps. null = no cap. */
  target?: Money | null;
  /** Steps: tranche sizes; the last one repeats until the hard cap. */
  tranches?: Money[] | null;
  maxPerMonth?: Money | null;
  fixedAmount?: Money | null;
  /** 1 to 12: the balance resets to zero when this month starts. */
  resetMonth?: number | null;
  linkedAccountId?: string | null;
  /** Share of a linked account, basis points, when several funds share it. */
  shareBp?: number | null;
  startBalance?: Money | null;
  archived?: boolean;
}

export interface MonthOverride {
  month: YearMonth;
  /** Fund ids in this month's priority order. Funds not listed follow in default order. */
  order?: string[] | null;
  pins?: Record<string, Money>;
  skips?: string[];
}
