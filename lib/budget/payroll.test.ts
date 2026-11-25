import { describe, expect, it } from "vitest";
import type { PayslipLine } from "@/lib/engine/payslip";
import { p } from "@/lib/engine/fixtures";
import { payrollOnLines } from "./payroll";

const l = (over: Partial<PayslipLine>): PayslipLine => ({ kind: "deduction", label: "HMO", source: "other_deduction", amount: p(300), ...over });
const groups = [{ id: "ess", feedsSavings: false }, { id: "sav", feedsSavings: true }, { id: "want", feedsSavings: false }];

describe("payrollOnLines", () => {
  it("lists a deduction in its category with the cutoffs it comes off, and adds the months", () => {
    const r = payrollOnLines({ first: { lines: [l({ ref: "want" })] }, second: { lines: [l({ ref: "want", amount: p(500) })] } }, groups);
    expect(r.want).toEqual([{ label: "HMO", kind: "other", cutoff: "both", first: p(300), second: p(500), amount: p(800) }]);
  });
  it("shows a deduction on one cutoff only as that cutoff", () => {
    const r = payrollOnLines({ first: { lines: [] }, second: { lines: [l({ ref: "want" })] } }, groups);
    expect(r.want![0]).toMatchObject({ cutoff: "second", first: 0, second: p(300) });
  });
  it("puts a deduction with no category, or a gone one, in the first spending category, and the savings plan in the savings one", () => {
    const r = payrollOnLines({ first: { lines: [l({}), l({ ref: "gone", label: "Old" }), l({ source: "savings_plan", label: "Savings plan" })] }, second: { lines: [] } }, groups);
    expect(r.ess!.map((x) => x.label)).toEqual(["HMO", "Old"]);
    expect(r.sav![0]).toMatchObject({ label: "Savings plan", kind: "plan" });
  });
});
