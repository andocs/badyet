import type { YearMonth } from "@/lib/domain/dates";
import { money, ZERO } from "@/lib/domain/money";
import type { Allowance, Assumptions, PaySettings, RaiseAllocation, SalaryEvent } from "./types";

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
  savings_plan_bp: number;
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

export const paySettingsOf = (r: PaySettingsRow | null): PaySettings =>
  r
    ? {
        sssOverride: m(r.sss_override),
        philhealthOverride: m(r.philhealth_override),
        pagibigOverride: m(r.pagibig_override),
        taxOverrideFirst: m(r.tax_override_first),
        taxOverrideSecond: m(r.tax_override_second),
        otherDeduction: money(r.other_deduction),
        savingsPlanBp: r.savings_plan_bp,
      }
    : DEFAULT_PAY_SETTINGS;

export const raiseAllocationOf = (r: RaiseAllocationRow): RaiseAllocation => ({
  salaryEventId: r.salary_event_id,
  budgetLineId: r.budget_line_id,
  mode: r.mode,
  amount: m(r.amount),
  pctBp: r.pct_bp,
});
