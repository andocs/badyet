import type { YearMonth } from "@/lib/domain/dates";
import { money, ZERO } from "@/lib/domain/money";
import type { PayslipLineSpec, PayslipTemplate } from "./payslip";
import type { Allowance, Assumptions, BonusInstance, BonusRule, BonusSplit, OtherDeductionItem, PaySettings, RaiseAllocation, SalaryEvent } from "./types";

/** Database rows (snake_case, as Supabase returns them) turned into the engine's shapes. Dates become YearMonth. */

const ym = (d: string): YearMonth => d.slice(0, 7) as YearMonth;
const m = (n: number | null | undefined) => (n == null ? null : money(n));

export interface SalaryEventRow {
  id: string;
  effective_month: string;
  kind: SalaryEvent["kind"];
  pct_bp: number | null;
  new_base: number | null;
  allowance_id: string | null;
  one_off_amount: number | null;
  one_off_taxable: boolean;
  status: SalaryEvent["status"];
}

export interface AllowanceRow {
  id: string;
  payslip_cutoff: Allowance["payslipCutoff"];
  name: string;
  amount: number;
  frequency: Allowance["frequency"];
  pay_month: number | null;
  taxable: boolean;
  starts_on: string;
  ends_on: string | null;
}

export interface AssumptionsRow {
  cip_multiplier_num: number;
  assumed_raise_on: boolean;
  assumed_raise_bp: number;
  assumed_raise_month: number;
}

export interface PaySettingsRow {
  sss_override: number | null;
  philhealth_override: number | null;
  pagibig_override: number | null;
  tax_override_first: number | null;
  tax_override_second: number | null;
  other_deduction: number;
  /** Added in rev-40; absent on a database without that update. */
  other_deduction_label?: string | null;
  /** From a newer migration: the list of other deductions, in centavos. */
  other_deductions?: unknown;
  savings_plan_bp: number;
  /** From a newer migration; absent until it is applied. */
  savings_plan_amount?: number | null;
  savings_plan_fund_id?: string | null;
}

export interface RaiseAllocationRow {
  salary_event_id: string;
  budget_line_id: string;
  mode: "amount" | "percent";
  amount: number | null;
  pct_bp: number | null;
}

export const salaryEventOf = (r: SalaryEventRow): SalaryEvent => ({
  id: r.id,
  effectiveMonth: ym(r.effective_month),
  kind: r.kind,
  pctBp: r.pct_bp,
  newBase: m(r.new_base),
  allowanceId: r.allowance_id,
  oneOffAmount: m(r.one_off_amount),
  oneOffTaxable: r.one_off_taxable,
  status: r.status,
});

export const allowanceOf = (r: AllowanceRow): Allowance => ({
  id: r.id,
  payslipCutoff: r.payslip_cutoff,
  name: r.name,
  amount: money(r.amount),
  frequency: r.frequency,
  payMonth: r.pay_month,
  taxable: r.taxable,
  startsOn: ym(r.starts_on),
  endsOn: r.ends_on ? ym(r.ends_on) : null,
});

export const DEFAULT_ASSUMPTIONS: Assumptions = { cipMultiplierNum: 125, assumedRaiseOn: false, assumedRaiseBp: 0, assumedRaiseMonth: 3 };

export const assumptionsOf = (r: AssumptionsRow | null): Assumptions =>
  r
    ? { cipMultiplierNum: r.cip_multiplier_num, assumedRaiseOn: r.assumed_raise_on, assumedRaiseBp: r.assumed_raise_bp, assumedRaiseMonth: r.assumed_raise_month }
    : DEFAULT_ASSUMPTIONS;

export const DEFAULT_PAY_SETTINGS: PaySettings = {
  sssOverride: null,
  philhealthOverride: null,
  pagibigOverride: null,
  taxOverrideFirst: null,
  taxOverrideSecond: null,
  otherDeduction: ZERO,
  savingsPlanBp: 0,
};

/** Reads the stored list of other deductions, skipping anything that is not a well-formed item. */
export function otherDeductionsOf(raw: unknown): OtherDeductionItem[] {
  if (!Array.isArray(raw)) return [];
  const out: OtherDeductionItem[] = [];
  for (const x of raw) {
    const o = x as { label?: unknown; cutoff?: unknown; amount?: unknown; amountSecond?: unknown; groupId?: unknown } | null;
    if (!o || typeof o.amount !== "number" || !Number.isInteger(o.amount) || o.amount < 0) continue;
    const cutoff = o.cutoff === "first" || o.cutoff === "second" ? o.cutoff : "both";
    const second = typeof o.amountSecond === "number" && Number.isInteger(o.amountSecond) && o.amountSecond >= 0 ? money(o.amountSecond) : null;
    out.push({ label: typeof o.label === "string" ? o.label : "", cutoff, amount: money(o.amount), amountSecond: cutoff === "both" ? second : null, groupId: typeof o.groupId === "string" && o.groupId !== "" ? o.groupId : null });
  }
  return out;
}

export const paySettingsOf = (r: PaySettingsRow | null): PaySettings =>
  r
    ? {
        // A stored 0 is not a figure you chose: the old data copy wrote 0 where nothing had been typed. It means "work it from my
        // salary". To take nothing, type 0 on the payslip line itself.
        sssOverride: m(r.sss_override || null),
        philhealthOverride: m(r.philhealth_override),
        pagibigOverride: m(r.pagibig_override || null),
        taxOverrideFirst: m(r.tax_override_first),
        taxOverrideSecond: m(r.tax_override_second),
        otherDeduction: money(r.other_deduction),
        otherDeductionLabel: r.other_deduction_label ?? null,
        otherDeductions: otherDeductionsOf(r.other_deductions),
        savingsPlanBp: r.savings_plan_bp,
        savingsPlanAmount: m(r.savings_plan_amount ?? null),
        savingsPlanFundId: r.savings_plan_fund_id ?? null,
      }
    : DEFAULT_PAY_SETTINGS;

export const raiseAllocationOf = (r: RaiseAllocationRow): RaiseAllocation => ({
  salaryEventId: r.salary_event_id,
  budgetLineId: r.budget_line_id,
  mode: r.mode,
  amount: m(r.amount),
  pctBp: r.pct_bp,
});

// ---------- bonuses ----------

export interface BonusRuleRow {
  id: string;
  payslip_cutoff: "first" | "second";
  recurrence: "yearly" | "once";
  kind: "thirteenth" | "cip" | "custom" | "oneoff";
  name: string;
  pay_month: number;
  once_on: string | null;
  formula: "base_multiple" | "eligible_x_component_x_multiplier" | "fixed";
  base_multiple_bp: number | null;
  eligible_amount: number | null;
  component_num: number | null;
  fixed_amount: number | null;
  de_minimis: number;
}
export interface BonusSplitRow {
  rule_id: string;
  target_kind: BonusSplit["targetKind"];
  target_id: string | null;
  label: string | null;
  mode: "amount" | "percent";
  amount: number | null;
  pct_bp: number | null;
}
export interface BonusInstanceRow {
  id: string;
  rule_id: string;
  year: number;
  multiplier_num: number | null;
  status: "planned" | "received";
  gross_actual: number | null;
  de_minimis_actual: number | null;
  net_actual: number | null;
}
export interface BonusInstanceSplitRow {
  instance_id: string;
  target_kind: BonusSplit["targetKind"];
  target_id: string | null;
  label: string | null;
  amount: number;
}

/** Bonus rules with their default splits. The CIP's eligible figure is read as typed for the year of the rule's earliest instance. */
export function bonusRulesOf(rules: readonly BonusRuleRow[], splits: readonly BonusSplitRow[], instances: readonly BonusInstanceRow[]): BonusRule[] {
  return rules.map((r) => {
    const years = instances.filter((i) => i.rule_id === r.id).map((i) => i.year);
    return {
      id: r.id,
      payslipCutoff: r.payslip_cutoff,
      recurrence: r.recurrence,
      kind: r.kind,
      name: r.name,
      payMonth: r.pay_month,
      onceOn: r.once_on ? ym(r.once_on) : null,
      formula: r.formula,
      baseMultipleBp: r.base_multiple_bp,
      eligibleAmount: m(r.eligible_amount),
      eligibleRefYear: years.length ? Math.min(...years) : null,
      componentNum: r.component_num,
      fixedAmount: m(r.fixed_amount),
      deMinimis: money(r.de_minimis),
      splits: splits
        .filter((s) => s.rule_id === r.id)
        .map((s) => ({ targetKind: s.target_kind, targetId: s.target_id, label: s.label, mode: s.mode, amount: m(s.amount), pctBp: s.pct_bp })),
    };
  });
}

export function bonusInstancesOf(rows: readonly BonusInstanceRow[], splits: readonly BonusInstanceSplitRow[]): BonusInstance[] {
  return rows.map((r) => {
    const own = splits.filter((s) => s.instance_id === r.id);
    return {
      ruleId: r.rule_id,
      year: r.year,
      multiplierNum: r.multiplier_num,
      status: r.status,
      grossActual: m(r.gross_actual),
      deMinimisActual: m(r.de_minimis_actual),
      netActual: m(r.net_actual),
      splits: own.length ? own.map((s) => ({ targetKind: s.target_kind, targetId: s.target_id, label: s.label, mode: "amount" as const, amount: money(s.amount) })) : null,
    };
  });
}

// ---------- payslip templates ----------

export interface TemplateRow { id: string; cutoff: "first" | "second"; effective_month: string }
export interface TemplateLineRow {
  template_id: string;
  kind: "earning" | "deduction";
  label: string;
  source: PayslipLineSpec["source"] | "allowance";
  share_bp: number | null;
  amount_override: number | null;
  sort: number;
}

/** Templates with their lines in order. Lines that point at an allowance are dropped: allowances are placed by their own cutoff setting. */
export function templatesOf(templates: readonly TemplateRow[], lines: readonly TemplateLineRow[]): PayslipTemplate[] {
  return templates.map((t) => ({
    cutoff: t.cutoff,
    effectiveMonth: ym(t.effective_month),
    lines: lines
      .filter((l) => l.template_id === t.id && l.source !== "allowance")
      .sort((a, b) => a.sort - b.sort)
      .map((l) => ({ kind: l.kind, label: l.label, source: l.source as PayslipLineSpec["source"], shareBp: l.share_bp, amountOverride: m(l.amount_override) })),
  }));
}

/** Lays the savings plan's amount and fund over the pay settings row. They come from a newer migration, so they are asked for on their own and ignored if that fails. */
export const withPlanExtra = (row: PaySettingsRow | null, extra: { data: unknown; error: unknown }): PaySettingsRow | null =>
  row && !extra.error && extra.data ? { ...row, ...(extra.data as Partial<PaySettingsRow>) } : row;
