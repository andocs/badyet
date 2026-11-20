import { describe, expect, it } from "vitest";
import { resolveSalaryTimeline } from "./salary";
import { allowance2, noAssumptions, p, startEvent, ym } from "./fixtures";
import type { Allowance, SalaryEvent } from "./types";

const merit: SalaryEvent = { id: "m1", effectiveMonth: ym("2027-03"), kind: "merit", pctBp: 500, status: "confirmed" };
const promo: SalaryEvent = { id: "p1", effectiveMonth: ym("2027-07"), kind: "promotion", newBase: p(60_000), status: "expected" };
const months = [ym("2027-02"), ym("2027-03"), ym("2027-07"), ym("2027-08")];

describe("salary timeline", () => {
  const run = (includeExpected: boolean, extra: Partial<typeof noAssumptions> = {}, al: Allowance[] = [allowance2]) =>
    resolveSalaryTimeline([startEvent, merit, promo], al, { ...noAssumptions, ...extra }, months, { includeExpected });

  it("applies start, merit by percent and an expected promotion in order", () => {
    const t = run(true);
    expect(t.map((m) => m.base)).toEqual([p(50_000), p(52_500), p(60_000), p(60_000)]);
    expect(t.map((m) => m.expected)).toEqual([false, false, true, true]);
  });

  it("drops expected events in the 'without expected raises' view", () => {
    const t = run(false);
    expect(t.map((m) => m.base)).toEqual([p(50_000), p(52_500), p(52_500), p(52_500)]);
    expect(t.some((m) => m.expected)).toBe(false);
  });

  it("hides an allowance tied to an expected event unless expected is included", () => {
    const newAllowance: Allowance = { ...allowance2, id: "al3", name: "New", amount: p(1_000), startsOn: ym("2027-07") };
    const link: SalaryEvent = { id: "a1", effectiveMonth: ym("2027-07"), kind: "allowance", allowanceId: "al3", status: "expected" };
    const args = [[startEvent, link], [allowance2, newAllowance], noAssumptions, [ym("2027-08")]] as const;
    const withE = resolveSalaryTimeline(...args, { includeExpected: true })[0]!;
    const without = resolveSalaryTimeline(...args, { includeExpected: false })[0]!;
    expect(withE.allowances.map((a) => a.allowance.id)).toEqual(["al2", "al3"]);
    expect(without.allowances.map((a) => a.allowance.id)).toEqual(["al2"]);
  });

  it("credits a yearly allowance only in its month, and one-offs only in theirs", () => {
    const yearly: Allowance = { ...allowance2, id: "y", frequency: "yearly", payMonth: 12, amount: p(12_000) };
    const adj: SalaryEvent = { id: "adj", effectiveMonth: ym("2027-02"), kind: "adjustment", oneOffAmount: p(3_000), oneOffTaxable: true, status: "confirmed" };
    const t = resolveSalaryTimeline([startEvent, adj], [yearly], noAssumptions, [ym("2027-02"), ym("2027-12"), ym("2028-01")], { includeExpected: true });
    expect(t.map((m) => m.allowances.length)).toEqual([0, 1, 0]);
    expect(t[0]!.oneOffs).toEqual([{ amount: p(3_000), taxable: true }]);
    expect(t[1]!.oneOffs).toEqual([]);
  });

  it("projects a yearly raise only after the year of the last salary event, flagged assumed", () => {
    const t = resolveSalaryTimeline(
      [startEvent, merit],
      [],
      { ...noAssumptions, assumedRaiseOn: true, assumedRaiseBp: 300, assumedRaiseMonth: 3 },
      [ym("2027-12"), ym("2028-02"), ym("2028-03"), ym("2029-03")],
      { includeExpected: false },
    );
    expect(t.map((m) => m.base)).toEqual([p(52_500), p(52_500), p(54_075), p(55_697.25)]);
    expect(t.map((m) => m.assumed)).toEqual([false, false, true, true]);
  });

  it("is off when the assumption is off", () => {
    const t = resolveSalaryTimeline([startEvent], [], noAssumptions, [ym("2030-06")], { includeExpected: false });
    expect(t[0]).toMatchObject({ base: p(50_000), assumed: false });
  });
});
