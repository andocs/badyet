import { describe, expect, it } from "vitest";
import type { ProjectionMonth } from "@/lib/engine/projection";
import { p } from "@/lib/engine/fixtures";
import { forecastRows } from "./forecast";

const month = (m: string, amount: number, bonus: number, plan: number, balanceAfter: number): ProjectionMonth =>
  ({
    month: m, assumed: false, expected: false, bonuses: [],
    pay: { takeHome: p(50_000) },
    budget: { savingsPool: p(amount), tight: { first: false, second: false }, over: { first: false, second: false } },
    funds: { unplaced: p(0), funds: [{ fundId: "f", amount: p(amount), bonus: p(bonus), plan: p(plan), balanceAfter: p(balanceAfter), reasons: [] }] },
  }) as unknown as ProjectionMonth;

describe("forecast rows: the payroll savings plan", () => {
  it("shows what the plan put in on its own, and counts it with the money credited straight to the fund", () => {
    const [row] = forecastRows([month("2026-12", 1_000, 500, 1_000, 2_500)], new Set());
    expect(row!.funds.f!.plan).toBe(p(1_000));
    expect(row!.funds.f!.bonus).toBe(p(1_500)); // bonus 500 + plan 1,000
    expect(row!.funds.f!.amount).toBe(p(1_000));
  });
});
