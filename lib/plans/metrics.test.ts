import { describe, expect, it } from "vitest";
import { money } from "@/lib/domain/money";
import { diffMetrics, type PlanMetrics } from "./metrics";

const m = (n: number) => money(Math.round(n * 100));
const cur: PlanMetrics = { netFirst: m(25_000), netSecond: m(30_000), leftToBudget: m(1_000), savingsPerMonth: m(5_000), savingsAfter12: m(60_000) };

describe("diffMetrics", () => {
  it("is the second plan minus the first, so a raise reads as positive", () => {
    const raise: PlanMetrics = { netFirst: m(27_000), netSecond: m(33_000), leftToBudget: m(8_000), savingsPerMonth: m(7_000), savingsAfter12: m(84_000) };
    expect(diffMetrics(cur, raise)).toEqual({ netFirst: m(2_000), netSecond: m(3_000), leftToBudget: m(7_000), savingsPerMonth: m(2_000), savingsAfter12: m(24_000) });
  });
  it("is negative when the other plan is worse, and null without a forecast", () => {
    const less: PlanMetrics = { ...cur, netFirst: m(24_000), savingsAfter12: null };
    const d = diffMetrics(cur, less);
    expect(d.netFirst).toBe(m(-1_000));
    expect(d.savingsAfter12).toBeNull();
  });
});
