import { describe, expect, it } from "vitest";
import type { ProjectionMonth } from "@/lib/engine/projection";
import { p } from "@/lib/engine/fixtures";
import { forecastRows } from "./forecast";

const month = (m: string, amount: number, bonus: number, balanceAfter: number, planPerCutoff = 0): ProjectionMonth =>
  ({
    month: m, assumed: false, expected: false, bonuses: [],
    pay: {
      takeHome: p(50_000),
      first: { lines: planPerCutoff ? [{ source: "savings_plan", amount: p(planPerCutoff) }] : [] },
      second: { lines: planPerCutoff ? [{ source: "savings_plan", amount: p(planPerCutoff) }] : [] },
    },
    budget: { savingsPool: p(amount), tight: { first: false, second: false }, over: { first: false, second: false } },
    funds: { unplaced: p(0), funds: [{ fundId: "f", amount: p(amount), bonus: p(bonus), balanceAfter: p(balanceAfter), reasons: [] }] },
  }) as unknown as ProjectionMonth;

describe("forecast rows: saved so far", () => {
  it("adds up what went in, starting from today's balance, and does not drop when the fund resets", () => {
    // A fund that resets in January: the balance falls to the month's own money, but what was saved keeps adding up.
    const rows = forecastRows([month("2026-11", 1_000, 0, 6_000), month("2026-12", 1_000, 500, 7_500), month("2027-01", 1_000, 0, 1_000)], new Set(), { f: p(5_000) });
    expect(rows.map((r) => r.funds.f!.balance)).toEqual([p(6_000), p(7_500), p(1_000)]);
    expect(rows.map((r) => r.funds.f!.saved)).toEqual([p(6_000), p(7_500), p(8_500)]);
  });

  it("shows what the payroll savings plan put in, apart from bonuses", () => {
    // Plan: 500 a cutoff, so 1,000 a month; the fund was credited 1,000 plan + 500 bonus.
    const [row] = forecastRows([month("2026-12", 0, 1_500, 1_500, 500)], new Set(), {}, "f");
    expect(row!.funds.f!.plan).toBe(p(1_000));
    expect(row!.funds.f!.bonus).toBe(p(1_500));
    // No plan fund chosen: nothing is shown as plan money.
    expect(forecastRows([month("2026-12", 0, 1_500, 1_500, 500)], new Set(), {}, null)[0]!.funds.f!.plan).toBe(0);
  });
});
