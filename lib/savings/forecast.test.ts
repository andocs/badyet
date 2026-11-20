import { describe, expect, it } from "vitest";
import { money } from "@/lib/domain/money";
import { buildMonths, runForecast, type ForecastInputs } from "./forecast";

const p = (n: number) => money(n * 100);
const inputs: ForecastInputs = {
  savings: {
    startMonth: "2026-12",
    start: { ef: p(0), travel: p(0), wants: p(0) },
    priority: "EF,TRAVEL,WANTS",
    settings: { efTranche: p(100_000), efHardCap: p(500_000), travelCap: p(150_000), wantsCap: p(60_000), defaultOrder: ["EF", "TRAVEL", "WANTS"] },
  },
  monthlyPool: p(40_000),
  cipByMonth: {},
  overrides: {},
  months: 3,
};

describe("buildMonths", () => {
  it("lists consecutive months and adds the CIP net to its month", () => {
    const m = buildMonths({ ...inputs, cipByMonth: { "2027-01": p(60_000) }, overrides: { "2027-02": "EF" } });
    expect(m.map((x) => x.month)).toEqual(["2026-12", "2027-01", "2027-02"]);
    expect(m[0].pool).toBe(p(40_000));
    expect(m[1].pool).toBe(p(100_000));
    expect(m[1].cip).toBe(true);
    expect(m[2].override).toBe("EF");
    expect(m[0].cip).toBeUndefined();
  });
});

// The domain allocator is tested in allocator.test.ts. These check our wiring around it.
describe("runForecast", () => {
  it("funds the Emergency fund first, then Travel leads from January", () => {
    const r = runForecast(inputs);
    expect(r[0].balances.ef).toBe(p(40_000)); // Dec: default order, EF first
    expect(r[1].balances.travel).toBe(p(40_000)); // Jan: Travel-first window opens
    expect(r[2].balances.travel).toBe(p(80_000));
    expect(r[2].balances.ef).toBe(p(40_000));
    expect(r.every((x) => x.unallocated === 0)).toBe(true);
  });
  it("lets a per-month override lead", () => {
    const r = runForecast({ ...inputs, overrides: { "2027-02": "EF" } });
    expect(r[2].balances.ef).toBe(p(80_000));
    expect(r[2].balances.travel).toBe(p(40_000));
  });
  it("marks a goal as having hit its step", () => {
    const r = runForecast({ ...inputs, cipByMonth: { "2026-12": p(60_000) } });
    expect(r[0].balances.ef).toBe(p(100_000));
    expect(r[0].status.EF).toBe("CAP_HIT");
  });
});
