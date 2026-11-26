import { describe, expect, it } from "vitest";
import { allowanceOf, assumptionsOf, DEFAULT_ASSUMPTIONS, DEFAULT_PAY_SETTINGS, paySettingsOf, raiseAllocationOf, salaryEventOf } from "./rows";

describe("row mapping", () => {
  it("turns dates into months and nulls into nulls", () => {
    expect(
      salaryEventOf({ id: "e", effective_month: "2027-03-01", kind: "merit", pct_bp: 500, new_base: null, allowance_id: null, one_off_amount: null, one_off_taxable: false, status: "expected" }),
    ).toEqual({ id: "e", effectiveMonth: "2027-03", kind: "merit", pctBp: 500, newBase: null, allowanceId: null, oneOffAmount: null, oneOffTaxable: false, status: "expected" });
    expect(allowanceOf({ id: "a", payslip_cutoff: "second", name: "Allowance", amount: 200000, frequency: "monthly", pay_month: null, taxable: false, starts_on: "2026-01-15", ends_on: null })).toMatchObject({
      startsOn: "2026-01",
      endsOn: null,
      amount: 200000,
    });
    expect(raiseAllocationOf({ salary_event_id: "e", budget_line_id: "l", mode: "percent", amount: null, pct_bp: 5000 })).toEqual({ salaryEventId: "e", budgetLineId: "l", mode: "percent", amount: null, pctBp: 5000 });
  });

  it("falls back to defaults when a user has no settings row", () => {
    expect(assumptionsOf(null)).toBe(DEFAULT_ASSUMPTIONS);
    expect(paySettingsOf(null)).toBe(DEFAULT_PAY_SETTINGS);
    expect(paySettingsOf({ sss_override: 175000, philhealth_override: null, pagibig_override: 20000, tax_override_first: null, tax_override_second: null, other_deduction: 0, savings_plan_bp: 600 })).toMatchObject({
      sssOverride: 175000,
      philhealthOverride: null,
      savingsPlanBp: 600,
    });
    expect(assumptionsOf({ cip_multiplier_num: 100, assumed_raise_on: true, assumed_raise_bp: 300, assumed_raise_month: 4 }).assumedRaiseMonth).toBe(4);
  });
});

describe("paySettingsOf: SSS and Pag-IBIG", () => {
  const row = { sss_override: 0, philhealth_override: null, pagibig_override: 0, tax_override_first: null, tax_override_second: null, other_deduction: 0, savings_plan_bp: 0 };
  it("treats a stored 0 as nothing typed, so they come from your salary", () => {
    expect(paySettingsOf(row)).toMatchObject({ sssOverride: null, pagibigOverride: null });
  });
  it("keeps an amount you did set", () => {
    expect(paySettingsOf({ ...row, sss_override: 175_000, pagibig_override: 20_000 })).toMatchObject({ sssOverride: 175_000, pagibigOverride: 20_000 });
  });
});
