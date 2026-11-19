import { describe, expect, it } from "vitest";
import { money } from "@/lib/domain/money";
import { computePay, type PayProfile } from "./compute";

const p = (pesos: number) => money(Math.round(pesos * 100));

// Synthetic salary (not real data). Hand-worked:
// annual 600,000 -> basic 25,000 per cutoff; PhilHealth 5% = 1,250.
// First cutoff: annual taxable 25,000*24 = 600,000 -> (22,500 + 200,000*20%) / 24 = 2,604.17; net 22,395.83.
// Second: mandatory 1,250+1,750+200 = 3,200; annual taxable (25,000-3,200)*24 = 523,200
//   -> (22,500 + 123,200*20%) / 24 = 1,964.17; net = 25,000 + 2,000 - 3,200 - 1,964.17 = 21,835.83.
const base: PayProfile = {
  annualBase: p(600_000),
  allowanceSecond: p(2_000),
  sss: p(1_750),
  pagibig: p(200),
  savingsPlanBp: 0,
  philhealthOverride: null,
  taxOverrideFirst: null,
  taxOverrideSecond: null,
};

describe("computePay", () => {
  it("matches the hand-worked first and second cutoff", () => {
    const r = computePay(base);
    expect(r.basicPerCutoff).toBe(p(25_000));
    expect(r.philhealth).toBe(p(1_250));
    expect(r.first.tax).toBe(p(2_604.17));
    expect(r.first.netBeforePlan).toBe(p(22_395.83));
    expect(r.second.mandatory).toBe(p(3_200));
    expect(r.second.tax).toBe(p(1_964.17));
    expect(r.second.netBeforePlan).toBe(p(21_835.83));
  });
  it("sums the month from the two cutoffs", () => {
    const r = computePay(base);
    expect(r.month.netBeforePlan).toBe(p(22_395.83 + 21_835.83));
    expect(r.month.takeHome).toBe(r.month.netBeforePlan);
  });
  it("takes the savings plan off take-home but not off tax", () => {
    const r = computePay({ ...base, savingsPlanBp: 600 });
    expect(r.first.plan).toBe(p(1_500));
    expect(r.first.tax).toBe(p(2_604.17));
    expect(r.first.takeHome).toBe(p(22_395.83 - 1_500));
  });
  it("uses overrides: PhilHealth changes tax, tax override replaces it", () => {
    const ph = computePay({ ...base, philhealthOverride: p(1_000) });
    expect(ph.philhealth).toBe(p(1_000));
    expect(ph.second.mandatory).toBe(p(2_950));
    const tax = computePay({ ...base, taxOverrideFirst: p(2_000) });
    expect(tax.first.tax).toBe(p(2_000));
    expect(tax.first.netBeforePlan).toBe(p(23_000));
  });
  it("pays no tax at or below the exempt bracket", () => {
    const r = computePay({ ...base, annualBase: p(240_000) });
    expect(r.first.tax).toBe(p(0));
  });
});
