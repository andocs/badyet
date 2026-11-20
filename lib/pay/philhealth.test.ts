import { describe, expect, it } from "vitest";
import { money } from "@/lib/domain/money";
import { philhealthMonthly } from "./philhealth";

const p = (n: number) => money(Math.round(n * 100));

describe("philhealthMonthly (employee share)", () => {
  it("is 2.5% of monthly basic in the normal range", () => {
    expect(philhealthMonthly(p(600_000))).toBe(p(1_250)); // 50,000 a month
    expect(philhealthMonthly(p(240_000))).toBe(p(500)); // 20,000 a month
  });
  it("uses the 10,000 floor for low salaries (250 minimum)", () => {
    expect(philhealthMonthly(p(96_000))).toBe(p(250)); // 8,000 a month counts as 10,000
  });
  it("stops at the 100,000 ceiling (2,500 maximum)", () => {
    expect(philhealthMonthly(p(2_400_000))).toBe(p(2_500)); // 200,000 a month counts as 100,000
    expect(philhealthMonthly(p(1_200_000))).toBe(p(2_500)); // exactly 100,000 a month
  });
});
