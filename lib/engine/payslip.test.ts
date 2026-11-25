import { describe, expect, it } from "vitest";
import { money } from "@/lib/domain/money";
import { TAX_ROWS } from "@/lib/pay/tax-table";
import { buildMonthPay, defaultTemplate, cutoffIncomeTax, oneTimeIncomeTax, savingsPlanPerCutoff, templateFor, type PayslipTemplate } from "./payslip";
import { resolveSalaryTimeline } from "./salary";
import { allowance2, noAssumptions, p, settings, startEvent, ym } from "./fixtures";
import type { Allowance } from "./types";
import type { BonusPayment } from "./bonus";

const salaryFor = (allowances: Allowance[] = [allowance2], month = "2027-03") =>
  resolveSalaryTimeline([startEvent], allowances, noAssumptions, [ym(month)], { includeExpected: true })[0]!;

// Hand-worked (base 50,000; SSS 1,750; PhilHealth 2.5% of 50,000 = 1,250; Pag-IBIG 200; PenBoost 750 by default), tax per cutoff on that
// cutoff's taxable pay x 24:
// first cutoff taxable 25,000 -> 600,000 -> 22,500 + 200,000 x 20% = 62,500 -> /24 = 2,604.17.
// second cutoff taxable 25,000 - 3,200 - 750 = 21,050 -> 505,200 -> 22,500 + 105,200 x 20% = 43,540 -> /24 = 1,814.17.
describe("payslip builder", () => {
  it("works out a cutoff's tax from its own taxable pay, annualized by 24", () => {
    expect(cutoffIncomeTax(TAX_ROWS, p(25_000))).toBe(p(2_604.17));
    expect(cutoffIncomeTax(TAX_ROWS, p(21_800))).toBe(p(1_964.17));
    expect(cutoffIncomeTax(TAX_ROWS, p(0))).toBe(0);
  });

  it("taxes a one-time taxable amount at the marginal rate on top of the regular year", () => {
    // +10,000 one-time on regular 46,800 a month: annual 571,600 -> tax 56,820 against 54,820, so 2,000 more.
    expect(oneTimeIncomeTax(TAX_ROWS, p(46_800), p(10_000))).toBe(p(2_000));
    expect(oneTimeIncomeTax(TAX_ROWS, p(46_800), money(0))).toBe(0);
  });

  it("works each cutoff's tax on its own pay and puts contributions and the allowance on the second", () => {
    const pay = buildMonthPay(salaryFor(), settings, []);
    expect(pay.taxFirst).toBe(p(2_604.17));
    expect(pay.taxSecond).toBe(p(1_814.17));
    expect(pay.tax).toBe(p(4_418.34));
    expect(pay.first.takeHome).toBe(p(22_395.83)); // 25,000 - 2,604.17
    expect(pay.second.takeHome).toBe(p(21_235.83)); // 25,000 + 2,000 - 1,814.17 - 1,750 - 1,250 - 200 - 750
    expect(pay.second.lines.map((l) => l.label)).toEqual(["Basic pay", "Income tax", "SSS", "PhilHealth", "Pag-IBIG", "SSS PenBoost", "Allowance"]);
    expect(pay.first.lines.map((l) => l.label)).toEqual(["Basic pay", "Income tax"]);
    expect(pay.takeHome).toBe(p(50_000 + 2_000 - 3_200 - 750 - 4_418.34));
    expect(pay.first.takeHome + pay.second.takeHome).toBe(pay.takeHome);
  });

  it("takes SSS PenBoost before tax, at the amount typed on its line", () => {
    const t: PayslipTemplate = { ...defaultTemplate("second"), effectiveMonth: ym("2026-01"), lines: defaultTemplate("second").lines.map((l) => (l.source === "penboost" ? { ...l, amountOverride: p(500) } : l)) };
    const pay = buildMonthPay(salaryFor(), settings, [], [t]);
    // second taxable 21,800 - 500 = 21,300 -> 511,200 -> 22,500 + 111,200 x 20% = 44,740 -> /24 = 1,864.17
    expect(pay.taxSecond).toBe(p(1_864.17));
    expect(pay.second.takeHome).toBe(p(27_000 - 1_864.17 - 3_200 - 500));
  });

  it("takes SSS and Pag-IBIG from the official tables, and PenBoost 750, when no amount is set", () => {
    const pay = buildMonthPay(salaryFor([]), { ...settings, sssOverride: null, pagibigOverride: null }, []);
    const amt = (src: string) => pay.second.lines.find((l) => l.source === src)?.amount;
    // Base 50,000: SSS monthly salary credit is the 35,000 maximum, so 5% = 1,750; Pag-IBIG is 2% of the 10,000 cap.
    expect([amt("sss"), amt("pagibig"), amt("penboost")]).toEqual([p(1_750), p(200), p(750)]);
  });

  it("lets the income tax line take a typed amount", () => {
    const t: PayslipTemplate = { ...defaultTemplate("first"), effectiveMonth: ym("2026-01"), lines: defaultTemplate("first").lines.map((l) => (l.source === "income_tax" ? { ...l, amountOverride: p(2_500) } : l)) };
    expect(buildMonthPay(salaryFor([]), settings, [], [t]).first.takeHome).toBe(p(25_000 - 2_500));
  });

  it("gives a template saved before PenBoost a zero PenBoost line on the second cutoff only", () => {
    const old: PayslipTemplate = { cutoff: "second", effectiveMonth: ym("2026-01"), lines: [{ kind: "deduction", label: "SSS", source: "sss" }] };
    expect(templateFor([old], "second", ym("2027-03")).lines.map((l) => l.source)).toEqual(["sss", "penboost"]);
  });

  it("lets a tax override replace that cutoff's tax line", () => {
    const pay = buildMonthPay(salaryFor(), { ...settings, taxOverrideFirst: p(2_000) }, []);
    expect(pay.first.takeHome).toBe(p(23_000));
    expect(pay.second.takeHome).toBe(p(21_235.83)); // second is unchanged
  });

  it("takes the savings plan and other deduction from every cutoff", () => {
    const pay = buildMonthPay(salaryFor([]), { ...settings, savingsPlanBp: 600, otherDeduction: p(300) }, []);
    // Plan: 6% of 25,000 = 1,500 per cutoff.
    expect(pay.first.takeHome).toBe(p(25_000 - 2_604.17 - 1_500 - 300));
  });

  it("puts each other deduction on the cutoff it names, with its own amount when on both", () => {
    const pay = buildMonthPay(salaryFor([]), {
      ...settings,
      otherDeductions: [
        { label: "HMO", cutoff: "first", amount: p(300), amountSecond: null },
        { label: "Loan", cutoff: "both", amount: p(500), amountSecond: p(800) },
        { label: "Dues", cutoff: "second", amount: p(100), amountSecond: null },
      ],
    }, []);
    const of = (slip: typeof pay.first) => slip.lines.filter((l) => l.source === "other_deduction").map((l) => [l.label, l.amount]);
    expect(of(pay.first)).toEqual([["HMO", p(300)], ["Loan", p(500)]]);
    expect(of(pay.second)).toEqual([["Loan", p(800)], ["Dues", p(100)]]);
  });

  it("uses the single other deduction only when the list is empty", () => {
    const withList = buildMonthPay(salaryFor([]), { ...settings, otherDeduction: p(300), otherDeductions: [{ label: "HMO", cutoff: "first", amount: p(100), amountSecond: null }] }, []);
    expect(withList.second.lines.some((l) => l.source === "other_deduction")).toBe(false);
    expect(withList.first.lines.find((l) => l.source === "other_deduction")!.amount).toBe(p(100));
  });

  it("includes a taxable monthly allowance in taxable income", () => {
    const taxable: Allowance = { ...allowance2, id: "t", taxable: true, amount: p(5_000) };
    const pay = buildMonthPay(salaryFor([taxable]), settings, []);
    // second taxable 25,000 + 5,000 - 3,200 - 750 = 26,050 -> 625,200 -> 22,500 + 225,200 x 20% = 67,540 -> /24 = 2,814.17
    expect(pay.taxSecond).toBe(p(2_814.17));
    expect(pay.tax).toBe(p(2_604.17 + 2_814.17));
  });

  it("places a bonus on its cutoff, de minimis on its own line, and taxes the leftover inside that cutoff's income tax", () => {
    const bonus: BonusPayment = {
      ruleId: "r", name: "CIP", kind: "cip", month: ym("2027-03"), cutoff: "first",
      gross: p(70_000), deMinimis: p(5_000), exempt: p(60_000), net: p(65_000), tax: p(5_000), received: false, splits: [],
    };
    const base = buildMonthPay(salaryFor(), settings, []);
    const withBonus = buildMonthPay(salaryFor(), settings, [bonus]);
    // Leftover taxable 70,000 - 5,000 - 60,000 = 5,000 joins the first cutoff: 30,000 -> 720,000 -> 86,500 -> /24 = 3,604.17.
    expect(withBonus.taxFirst).toBe(p(3_604.17));
    expect(withBonus.taxableFirst).toBe(p(30_000));
    expect(withBonus.first.takeHome).toBe(p(25_000 + 70_000 - 3_604.17));
    expect(withBonus.second.takeHome).toBe(base.second.takeHome);
    expect(withBonus.first.lines.map((l) => [l.label, l.amount])).toEqual([["Basic pay", p(25_000)], ["Income tax", p(3_604.17)], ["CIP", p(65_000)], ["CIP de minimis", p(5_000)]]);
  });

  it("adds nothing to tax when the whole bonus is tax-free", () => {
    const bonus: BonusPayment = { ruleId: "r", name: "Gift", kind: "custom", month: ym("2027-03"), cutoff: "second", gross: p(10_000), deMinimis: p(0), exempt: p(10_000), net: p(10_000), tax: p(0), received: false, splits: [] };
    expect(buildMonthPay(salaryFor(), settings, [bonus]).taxSecond).toBe(p(1_814.17));
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
    // 60% of 50,000 = 30,000 earned and taxed on its own: 720,000 -> 86,500 -> /24 = 3,604.17.
    expect(pay.first.takeHome).toBe(p(30_000 - 3_604.17));
  });

  it("a per-line amount override wins", () => {
    const t: PayslipTemplate = { cutoff: "second", effectiveMonth: ym("2026-01"), lines: [{ kind: "deduction", label: "SSS", source: "sss", amountOverride: p(999) }] };
    expect(buildMonthPay(salaryFor([]), settings, [], [t]).second.lines.find((l) => l.source === "sss")?.amount).toBe(p(999));
  });
});

describe("payroll savings plan", () => {
  it("takes a fixed amount a cutoff, or a percent of half the basic, and the fixed amount wins", () => {
    expect(savingsPlanPerCutoff({ savingsPlanBp: 600, savingsPlanAmount: null }, p(50_000))).toBe(p(1_500));
    expect(savingsPlanPerCutoff({ savingsPlanBp: 600, savingsPlanAmount: p(2_000) }, p(50_000))).toBe(p(2_000));
    expect(savingsPlanPerCutoff({ savingsPlanBp: 0, savingsPlanAmount: null }, p(50_000))).toBe(0);
  });
  it("shows as a Savings plan deduction on both payslips", () => {
    const pay = buildMonthPay(salaryFor([]), { ...settings, savingsPlanAmount: p(2_000) }, []);
    for (const slip of [pay.first, pay.second]) expect(slip.lines.find((l) => l.source === "savings_plan")?.amount).toBe(p(2_000));
  });
});

describe("tax working", () => {
  it("lays the annual tax out bracket by bracket and ends at the same total", async () => {
    const { taxBreakdown } = await import("./payslip");
    const { steps, annualTax } = taxBreakdown(TAX_ROWS, p(561_600));
    expect(annualTax).toBe(p(54_820));
    expect(steps.map((s) => s.hit)).toEqual([false, false, true, false, false, false]);
    expect(steps[1]).toMatchObject({ amountIn: p(150_000), tax: p(22_500) }); // 250k-400k at 15%
    expect(steps[2]).toMatchObject({ amountIn: p(161_600), tax: p(32_320) }); // 400k-561.6k at 20%
    expect(steps[3]!.amountIn).toBe(0);
    expect(steps.reduce((t, s) => t + s.tax, 0)).toBe(annualTax); // 22,500 + 32,320
  });
  it("is zero when nothing is taxable", async () => {
    const { taxBreakdown } = await import("./payslip");
    expect(taxBreakdown(TAX_ROWS, p(0)).annualTax).toBe(0);
  });
});
