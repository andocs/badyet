import { describe, expect, it } from "vitest";
import { money } from "@/lib/domain/money";
import { TAX_ROWS } from "@/lib/pay/tax-table";
import { buildMonthPay, defaultTemplate, monthlyIncomeTax, templateFor, type PayslipTemplate } from "./payslip";
import { resolveSalaryTimeline } from "./salary";
import { allowance2, noAssumptions, p, settings, startEvent, ym } from "./fixtures";
import type { Allowance } from "./types";
import type { BonusPayment } from "./bonus";

const salaryFor = (allowances: Allowance[] = [allowance2], month = "2027-03") =>
  resolveSalaryTimeline([startEvent], allowances, noAssumptions, [ym(month)], { includeExpected: true })[0]!;

// Hand-worked (base 50,000; SSS 1,750; PhilHealth 2.5% of 50,000 = 1,250; Pag-IBIG 200; mandatory 3,200):
// regular taxable 46,800 -> annual 561,600 -> bracket 400k-800k: 22,500 + 161,600 x 20% = 54,820 -> /12 = 4,568.33 a month.
// First cutoff tax 2,284.17 (half, rounded), second 2,284.16 (the remainder).
describe("payslip builder", () => {
  it("works out monthly tax from the annualized regular pay", () => {
    expect(monthlyIncomeTax(TAX_ROWS, p(46_800), money(0))).toBe(p(4_568.33));
    expect(monthlyIncomeTax(TAX_ROWS, p(0), money(0))).toBe(0);
  });

  it("taxes a one-time taxable amount at the marginal rate on top of the regular year", () => {
    // +10,000 one-time: annual 571,600 -> tax 56,820, so 2,000 more tax lands in that month.
    expect(monthlyIncomeTax(TAX_ROWS, p(46_800), p(10_000))).toBe(p(6_568.33));
  });

  it("splits tax across both cutoffs and puts contributions and the allowance on the second", () => {
    const pay = buildMonthPay(salaryFor(), settings, []);
    expect(pay.tax).toBe(p(4_568.33));
    expect(pay.first.takeHome).toBe(p(22_715.83)); // 25,000 - 2,284.17
    expect(pay.second.takeHome).toBe(p(21_515.84)); // 25,000 + 2,000 - 2,284.16 - 1,750 - 1,250 - 200
    expect(pay.second.lines.map((l) => l.label)).toEqual(["Basic pay", "Income tax", "SSS", "PhilHealth", "Pag-IBIG", "Allowance"]);
    expect(pay.first.lines.map((l) => l.label)).toEqual(["Basic pay", "Income tax"]);
    // Whole month: base + allowance - contributions - tax.
    expect(pay.takeHome).toBe(p(50_000 + 2_000 - 3_200 - 4_568.33));
    expect(pay.first.takeHome + pay.second.takeHome).toBe(pay.takeHome);
  });

  it("lets a tax override replace that cutoff's tax line", () => {
    const pay = buildMonthPay(salaryFor(), { ...settings, taxOverrideFirst: p(2_000) }, []);
    expect(pay.first.takeHome).toBe(p(23_000));
    expect(pay.second.takeHome).toBe(p(21_515.84)); // second is unchanged
  });

  it("takes the savings plan and other deduction from every cutoff", () => {
    const pay = buildMonthPay(salaryFor([]), { ...settings, savingsPlanBp: 600, otherDeduction: p(300) }, []);
    // Plan: 6% of 25,000 = 1,500 per cutoff.
    expect(pay.first.takeHome).toBe(p(25_000 - 2_284.17 - 1_500 - 300));
  });

  it("includes a taxable monthly allowance in taxable income", () => {
    const taxable: Allowance = { ...allowance2, id: "t", taxable: true, amount: p(5_000) };
    const pay = buildMonthPay(salaryFor([taxable]), settings, []);
    // taxable 51,800 -> annual 621,600 -> 22,500 + 221,600 x 20% = 66,820 -> /12 = 5,568.33
    expect(pay.tax).toBe(p(5_568.33));
  });

  it("places a bonus and its tax on the cutoff its rule names", () => {
    const bonus: BonusPayment = {
      ruleId: "r", name: "CIP", kind: "cip", month: ym("2027-03"), cutoff: "first",
      gross: p(70_000), deMinimis: p(0), exempt: p(60_000), net: p(65_000), tax: p(5_000), received: false, splits: [],
    };
    const base = buildMonthPay(salaryFor(), settings, []);
    const withBonus = buildMonthPay(salaryFor(), settings, [bonus]);
    expect(withBonus.first.takeHome).toBe(base.first.takeHome + p(65_000));
    expect(withBonus.second.takeHome).toBe(base.second.takeHome);
    expect(withBonus.first.lines.map((l) => l.label)).toContain("CIP tax");
  });

  it("uses a custom template from its effective month, and the default before it", () => {
    const custom: PayslipTemplate = {
      cutoff: "first",
      effectiveMonth: ym("2027-06"),
      lines: [
        { kind: "earning", label: "Basic pay", source: "base_share", shareBp: 6000 },
        { kind: "deduction", label: "Income tax", source: "income_tax", shareBp: 4000 },
      ],
    };
    expect(templateFor([custom], "first", ym("2027-05"))).toEqual(defaultTemplate("first"));
    expect(templateFor([custom], "first", ym("2027-06"))).toBe(custom);
    const pay = buildMonthPay(salaryFor([], "2027-06"), settings, [], [custom]);
    // 60% of 50,000 = 30,000 earned; 40% of tax 4,568.33 = 1,827.33.
    expect(pay.first.takeHome).toBe(p(30_000 - 1_827.33));
  });

  it("a per-line amount override wins", () => {
    const t: PayslipTemplate = { cutoff: "second", effectiveMonth: ym("2026-01"), lines: [{ kind: "deduction", label: "SSS", source: "sss", amountOverride: p(999) }] };
    expect(buildMonthPay(salaryFor([]), settings, [], [t]).second.deductions).toBe(p(999));
  });
});
