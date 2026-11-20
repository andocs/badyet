import { describe, expect, it } from "vitest";
import { EXEMPTION_CAP } from "@/lib/windfall/compute";
import { allocateSplits, fundCredits, planBonuses, type BonusPayment } from "./bonus";
import { resolveSalaryTimeline } from "./salary";
import { noAssumptions, p, settings, startEvent, ym } from "./fixtures";
import type { BonusInstance, BonusRule, SalaryEvent } from "./types";

const merit: SalaryEvent = { id: "m1", effectiveMonth: ym("2027-03"), kind: "merit", pctBp: 500, status: "confirmed" };
const salaryOf = (m: ReturnType<typeof ym>) => resolveSalaryTimeline([startEvent, merit], [], noAssumptions, [m], { includeExpected: true })[0]!;

const thirteenth: BonusRule = {
  id: "t13", payslipCutoff: "second", recurrence: "yearly", kind: "thirteenth", name: "13th month", payMonth: 12,
  formula: "base_multiple", baseMultipleBp: 10000, deMinimis: p(0), splits: [],
};
const cip: BonusRule = {
  id: "cip", payslipCutoff: "first", recurrence: "yearly", kind: "cip", name: "CIP", payMonth: 3,
  formula: "eligible_x_component_x_multiplier", eligibleAmount: p(400_000), eligibleRefYear: 2026, componentNum: 1_381_505,
  deMinimis: p(0), splits: [],
};
const run = (rules: BonusRule[], months: string[], instances: BonusInstance[] = []) =>
  planBonuses(rules, instances, salaryOf, settings, noAssumptions, months.map(ym));

describe("bonus plan", () => {
  it("13th month is one month of base pay, and a raise raises the next one", () => {
    const [a, b] = run([thirteenth], ["2026-12", "2027-12"]);
    expect(a!.gross).toBe(p(50_000));
    expect(b!.gross).toBe(p(52_500));
  });

  it("CIP is eligible x component x multiplier, scaled by base pay after a raise", () => {
    const [y26, y27] = run([cip], ["2026-03", "2027-03"]);
    expect(y26!.gross).toBe(p(69_075.25)); // 400,000 x 13.81505% x 1.25
    expect(y27!.gross).toBe(p(72_529.01)); // eligible grows with the 5% merit: 420,000
  });

  it("an instance's own Low/Base/High pick overrides the default multiplier", () => {
    const [low] = run([cip], ["2026-03"], [{ ruleId: "cip", year: 2026, multiplierNum: 100, status: "planned" }]);
    expect(low!.gross).toBe(p(55_260.2));
  });

  it("shares the yearly tax-free cap in pay-month order, and works a year in full even when only one month is asked for", () => {
    const [onlyDec] = run([thirteenth, cip], ["2026-12"]);
    const both = run([thirteenth, cip], ["2026-03", "2026-12"]);
    expect(both[0]).toMatchObject({ ruleId: "cip", tax: 0 }); // CIP lands first and is fully inside the cap
    const dec = both[1]!;
    expect(dec.exempt).toBe(p(90_000) - both[0]!.exempt); // the 13th month gets what is left of 90,000
    expect(dec.tax).toBeGreaterThan(0);
    expect(onlyDec).toEqual(dec);
    expect(both[0]!.exempt + dec.exempt).toBe(EXEMPTION_CAP);
  });

  it("a 13th month alone inside the cap has no tax and the 13th month never gets de minimis", () => {
    const [d] = run([{ ...thirteenth, deMinimis: p(5_000) }], ["2026-12"]);
    expect(d).toMatchObject({ net: p(50_000), tax: 0, deMinimis: 0 });
  });

  it("de minimis on a CIP is paid tax-free outside the cap", () => {
    const [c] = run([{ ...cip, deMinimis: p(12_000) }], ["2026-03"]);
    expect(c!.deMinimis).toBe(p(12_000));
    expect(c!.exempt).toBe(p(69_075.25 - 12_000));
  });

  it("a one-off lands once, in its month", () => {
    const oneOff: BonusRule = {
      id: "o", payslipCutoff: "second", recurrence: "once", kind: "oneoff", name: "Spot bonus", payMonth: 9, onceOn: ym("2027-09"),
      formula: "fixed", fixedAmount: p(20_000), deMinimis: p(0), splits: [],
    };
    expect(run([oneOff], ["2026-09", "2027-09", "2028-09"]).map((b) => [b.month, b.gross])).toEqual([["2027-09", p(20_000)]]);
  });

  it("a received instance uses its actuals", () => {
    const [d] = run([thirteenth], ["2026-12"], [{ ruleId: "t13", year: 2026, status: "received", grossActual: p(48_000), netActual: p(47_000) }]);
    expect(d).toMatchObject({ gross: p(48_000), net: p(47_000), tax: p(1_000), received: true });
  });
});

describe("bonus splits", () => {
  it("places flat and percent splits in order, capped by what is left", () => {
    const { placed, unplaced } = allocateSplits(p(100_000), [
      { targetKind: "fund", targetId: "ef", mode: "amount", amount: p(60_000) },
      { targetKind: "purchase", label: "Laptop", mode: "percent", pctBp: 2500 },
      { targetKind: "gift", label: "Mom's birthday", mode: "amount", amount: p(30_000) },
    ]);
    expect(placed.map((x) => x.amount)).toEqual([p(60_000), p(25_000), p(15_000)]);
    expect(unplaced).toBe(0);
  });

  it("leaves the unplaced rest, and only fund targets reach fund balances", () => {
    const payment: BonusPayment = {
      ruleId: "t13", name: "13th month", kind: "thirteenth", month: ym("2026-12"), cutoff: "second", gross: p(50_000), deMinimis: p(0),
      exempt: p(50_000), net: p(50_000), tax: p(0), received: false,
      splits: [
        { targetKind: "fund", targetId: "ef", mode: "amount", amount: p(20_000) },
        { targetKind: "gift", label: "Gifts", mode: "amount", amount: p(5_000) },
      ],
    };
    expect(allocateSplits(payment.net, payment.splits).unplaced).toBe(p(25_000));
    expect(fundCredits([payment]).get(ym("2026-12"))).toEqual({ ef: p(20_000) });
  });
});
