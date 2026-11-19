import { describe, expect, it } from "vitest";
import { money } from "@/lib/domain/money";
import type { PayProfile } from "@/lib/pay/compute";
import { computeEvents, grossOf, type WindfallEvent } from "./compute";

const p = (n: number) => money(Math.round(n * 100));
const profile: PayProfile = {
  annualBase: p(600_000),
  allowanceSecond: p(2_000),
  sss: p(1_750),
  pagibig: p(200),
  savingsPlanBp: 0,
  philhealthOverride: null,
  taxOverrideFirst: null,
  taxOverrideSecond: null,
};
const ev = (over: Partial<WindfallEvent>): WindfallEvent => ({
  id: "a",
  kind: "bonus",
  cutoff: "first",
  payDate: "2026-12-15",
  gross: p(1),
  cipEligible: null,
  cipComponentNum: null,
  cipMultiplierNum: null,
  ...over,
});

// Hand-worked, first cutoff: regular taxable 25,000 -> annualized 600,000 -> tax 62,500/24 = 2,604.17.
// With +10,000 taxable: 35,000 -> 840,000 -> (102,500 + 40,000 x 25%) / 24 = 4,687.50, so tax rises by 2,083.33.
describe("computeEvents", () => {
  it("a 13th month of one month's basic is fully tax-free under the cap", () => {
    const [r] = computeEvents(profile, [ev({ kind: "thirteenth", gross: null })]);
    expect(r.gross).toBe(p(50_000));
    expect(r.exempt).toBe(p(50_000));
    expect(r.net).toBe(p(50_000));
  });
  it("taxes only the part above the 90,000 cap", () => {
    const [r] = computeEvents(profile, [ev({ gross: p(100_000) })]);
    expect(r.exempt).toBe(p(90_000));
    expect(r.net).toBe(p(100_000 - 2_083.33));
  });
  it("shares the cap across events in the same year, in pay-date order", () => {
    const a = ev({ id: "a", payDate: "2026-12-01", gross: p(90_000) });
    const b = ev({ id: "b", payDate: "2026-12-20", gross: p(10_000) });
    const [ra, rb] = computeEvents(profile, [b, a]).sort((x, y) => x.id.localeCompare(y.id));
    expect(ra.exempt).toBe(p(90_000));
    expect(ra.net).toBe(p(90_000));
    expect(rb.exempt).toBe(0);
    expect(rb.net).toBe(p(10_000 - 2_083.33));
  });
  it("resets the cap each calendar year", () => {
    const a = ev({ id: "a", payDate: "2026-12-01", gross: p(90_000) });
    const b = ev({ id: "b", payDate: "2027-12-01", gross: p(50_000) });
    const r = computeEvents(profile, [a, b]);
    expect(r[1].exempt).toBe(p(50_000));
  });
  it("returns results in the order the events were given", () => {
    const r = computeEvents(profile, [ev({ id: "z", payDate: "2026-12-20" }), ev({ id: "y", payDate: "2026-12-01" })]);
    expect(r.map((x) => x.id)).toEqual(["z", "y"]);
  });
});

describe("grossOf", () => {
  it("computes CIP as eligible earnings x component x multiplier (rounded once)", () => {
    const g = grossOf(profile, ev({ kind: "cip", gross: null, cipEligible: p(600_000), cipComponentNum: 1_381_505, cipMultiplierNum: 125 }));
    expect(g).toBe(p(103_612.88));
  });
  it("treats an incomplete CIP as zero", () => {
    expect(grossOf(profile, ev({ kind: "cip", gross: null }))).toBe(0);
  });
});
