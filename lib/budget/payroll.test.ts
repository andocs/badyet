import { describe, expect, it } from "vitest";
import type { PayslipLine } from "@/lib/engine/payslip";
import { p } from "@/lib/engine/fixtures";
import { payrollOnLines } from "./payroll";

const l = (over: Partial<PayslipLine>): PayslipLine => ({ kind: "deduction", label: "HMO", source: "other_deduction", amount: p(300), ...over });

describe("payrollOnLines", () => {
  it("puts a deduction on its budget line, adding its cutoffs, and leaves the rest loose", () => {
    const r = payrollOnLines(
      { first: { lines: [l({ ref: "A" }), l({ label: "Loan" }), l({ source: "savings_plan", label: "Savings plan" })] }, second: { lines: [l({ ref: "A", amount: p(500) }), l({ ref: "gone", label: "Old" })] } },
      new Set(["A"]),
    );
    expect(r.byLine).toEqual({ A: [{ label: "HMO", amount: p(800) }] });
    expect(r.loose.map((x) => x.label)).toEqual(["Loan", "Savings plan", "Old"]);
  });
});
