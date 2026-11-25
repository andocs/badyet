import { describe, expect, it } from "vitest";
import { runProjection, runWithAndWithoutExpected, type ProjectionInput } from "./projection";
import { allowance2, noAssumptions, p, settings, startEvent, ym } from "./fixtures";
import type { BudgetLine, Fund } from "./types";

const line = (over: Partial<BudgetLine> & Pick<BudgetLine, "id">): BudgetLine => ({
  name: over.id, rule: "fixed", amount: p(0), cutoff: "both", feedsSavings: false, countsToDaily: false, kind: "normal", ...over,
});

const funds: Fund[] = [
  { id: "ef", name: "Emergency", priority: 1, rule: "steps", tranches: [p(100_000)], target: p(300_000) },
  { id: "travel", name: "Travel", priority: 2, rule: "reset", target: p(50_000), resetMonth: 1 },
];

const input: ProjectionInput = {
  start: ym("2027-01"),
  months: 12,
  events: [
    startEvent,
    { id: "promo", effectiveMonth: ym("2027-07"), kind: "promotion", newBase: p(60_000), status: "expected" },
  ],
  allowances: [allowance2],
  assumptions: noAssumptions,
  settings,
  bonusRules: [
    {
      id: "t13", payslipCutoff: "second", recurrence: "yearly", kind: "thirteenth", name: "13th month", payMonth: 12, formula: "base_multiple",
      baseMultipleBp: 10000, deMinimis: p(0), splits: [{ targetKind: "fund", targetId: "ef", mode: "percent", pctBp: 10000 }],
    },
  ],
  bonusInstances: [],
  lines: [
    line({ id: "rent", cutoff: "second", amount: p(10_000) }),
    line({ id: "food", amount: p(6_000), countsToDaily: true }),
    line({ id: "fun", rule: "pct", pctBp: 1000, countsToDaily: true }),
    line({ id: "rest", rule: "rest", feedsSavings: true }),
  ],
  allocations: [{ salaryEventId: "promo", budgetLineId: "fun", mode: "percent", pctBp: 5000 }],
  funds,
  fundStart: {},
};

describe("projection", () => {
  const cmp = runWithAndWithoutExpected(input);

  it("budget lines add up to take-home in every month", () => {
    for (const m of cmp.with) {
      const first = m.budget.lines.reduce((t, l) => t + l.first, 0);
      const second = m.budget.lines.reduce((t, l) => t + l.second, 0);
      expect(first).toBe(m.budget.rest.first + m.budget.planned.first);
      expect(second).toBe(m.budget.rest.second + m.budget.planned.second);
      expect(m.pay.first.takeHome + m.pay.second.takeHome).toBe(m.pay.takeHome);
    }
  });

  it("expected raises change nothing before they start, and raise take-home and the pool after", () => {
    const [jan, jun, jul, nov, dec] = [0, 5, 6, 10, 11].map((i) => cmp.difference[i]!);
    expect(jan).toMatchObject({ takeHome: 0, savingsPool: 0 });
    expect(jun).toMatchObject({ takeHome: 0, savingsPool: 0 });
    expect(jul.takeHome).toBeGreaterThan(0);
    expect(jul.savingsPool).toBeGreaterThan(0);
    // Half of each extra peso goes to the "fun" line (the raise allocation), so the pool gains less than the take-home does.
    expect(jul.savingsPool).toBeLessThan(jul.takeHome);
    expect(nov.takeHome).toBe(jul.takeHome);
    // December also carries the bigger 13th month (60,000 against 50,000), all of it inside the tax-free cap.
    expect(dec.takeHome).toBe(jul.takeHome + p(10_000));
    expect(cmp.with[6]!.expected).toBe(true);
    expect(cmp.without.some((m) => m.expected)).toBe(false);
  });

  it("the raise allocation exists only in the view that includes the expected raise", () => {
    const withLine = cmp.with[7]!.budget.lines.find((l) => l.lineId === "fun")!;
    const withoutLine = cmp.without[7]!.budget.lines.find((l) => l.lineId === "fun")!;
    expect(withLine.topUps).toHaveLength(1);
    expect(withoutLine.topUps).toEqual([]);
    expect(withLine.total).toBeGreaterThan(withoutLine.total);
  });

  it("a 13th month assigned to a fund goes straight in, on the payslip's cutoff, not through the pool", () => {
    const dec = cmp.with[11]!;
    expect(dec.bonuses).toHaveLength(1);
    expect(dec.bonuses[0]!.gross).toBe(p(60_000)); // base after the expected promotion
    expect(dec.pay.second.lines.some((l) => l.label === "13th month")).toBe(true);
    const ef = dec.funds.funds.find((f) => f.fundId === "ef")!;
    expect(ef.bonus).toBe(dec.bonuses[0]!.net);
    expect(cmp.without[11]!.bonuses[0]!.gross).toBe(p(50_000));
  });

  it("is deterministic and leaves its input alone", () => {
    const before = JSON.stringify(input);
    expect(runProjection(input, { includeExpected: true })).toEqual(cmp.with);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("funds never receive more than the pool across the year", () => {
    for (const m of cmp.with) {
      const taken = m.funds.funds.reduce((t, f) => t + f.amount, 0);
      expect(taken + m.funds.unplaced).toBe(m.budget.savingsPool);
    }
  });

  it("counts a payroll savings plan into the fund it names, without touching the budget", () => {
    const plain = runProjection({ ...input, bonusRules: [] }, { includeExpected: false });
    const withPlan = runProjection({ ...input, bonusRules: [], settings: { ...settings, savingsPlanAmount: p(2_000), savingsPlanFundId: "travel" } }, { includeExpected: false });
    // 2,000 a cutoff, two cutoffs a month, into Travel.
    expect(withPlan[0]!.funds.funds.find((f) => f.fundId === "travel")!.plan).toBe(p(4_000));
    // It is a payslip deduction, so take-home drops; the budget lines are worked on that lower take-home.
    expect(withPlan[0]!.pay.first.takeHome).toBe(plain[0]!.pay.first.takeHome - p(2_000));
    expect(plain[0]!.funds.funds.find((f) => f.fundId === "travel")!.plan).toBe(0);
  });

  it("does not count the plan in any fund when none is named", () => {
    const m = runProjection({ ...input, bonusRules: [], settings: { ...settings, savingsPlanAmount: p(2_000), savingsPlanFundId: null } }, { includeExpected: false });
    expect(m[0]!.funds.funds.every((f) => f.plan === 0)).toBe(true);
    expect(m[0]!.pay.first.lines.some((l) => l.source === "savings_plan")).toBe(true);
  });
});
