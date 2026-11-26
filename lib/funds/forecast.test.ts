import { describe, expect, it } from "vitest";
import { noAssumptions, p, settings, startEvent, ym } from "@/lib/engine/fixtures";
import { runProjection, type ProjectionInput } from "@/lib/engine/projection";
import type { BudgetLine, BonusRule, Fund } from "@/lib/engine/types";
import { forecastRows, savedThisMonth, totalBalance, yearEnds } from "./forecast";

const line = (over: Partial<BudgetLine> & Pick<BudgetLine, "id">): BudgetLine => ({ name: over.id, rule: "fixed", amount: p(0), cutoff: "both", feedsSavings: false, countsToDaily: false, kind: "normal", ...over });
const funds: Fund[] = [
  { id: "ef", name: "Emergency", priority: 1, rule: "steps", tranches: [p(100_000)], target: p(300_000), startBalance: p(20_000) },
  { id: "travel", name: "Travel", priority: 2, rule: "reset", target: p(500_000), resetMonth: 1 },
];
const thirteenth: BonusRule = {
  id: "t13", payslipCutoff: "second", recurrence: "yearly", kind: "thirteenth", name: "13th month", payMonth: 12, formula: "base_multiple", baseMultipleBp: 10000, deMinimis: p(0),
  splits: [{ targetKind: "fund", targetId: "travel", mode: "percent", pctBp: 5000 }],
};
const input: ProjectionInput = {
  start: ym("2027-01"), months: 24, events: [startEvent], allowances: [], assumptions: noAssumptions, settings, bonusRules: [thirteenth], bonusInstances: [],
  lines: [line({ id: "rent", amount: p(8_000) }), line({ id: "rest", rule: "rest", feedsSavings: true })],
  funds, fundStart: { ef: p(20_000) }, overrides: [{ month: ym("2027-03"), skips: ["ef"] }],
};
const run = runProjection(input, { includeExpected: true });
const rows = forecastRows(run, new Set(["2027-03"]));

describe("forecast rows", () => {
  it("one row per month with the pool, the funds and the flags", () => {
    expect(rows).toHaveLength(24);
    expect(rows[0]).toMatchObject({ month: "2027-01", year: 2027, override: false });
    expect(rows[2]).toMatchObject({ month: "2027-03", override: true });
    expect(rows[2]!.funds.ef!.reasons).toEqual(["skipped"]);
    expect(rows[2]!.funds.ef!.amount).toBe(0);
    expect(rows[0]!.pool).toBeGreaterThan(0);
  });

  it("balances only grow except when a reset fund restarts in January", () => {
    const ef = rows.map((r) => r.funds.ef!.balance);
    for (let i = 1; i < ef.length; i += 1) expect(ef[i]!).toBeGreaterThanOrEqual(ef[i - 1]!);
    const jan2028 = rows.find((r) => r.month === "2028-01")!;
    const dec2027 = rows.find((r) => r.month === "2027-12")!;
    expect(dec2027.funds.travel!.balance).toBeGreaterThan(0);
    expect(jan2028.funds.travel!.balance).toBeLessThanOrEqual(jan2028.funds.travel!.amount + jan2028.funds.travel!.bonus); // starts again from zero
  });

  it("a 13th month going to savings shows as bonus money in the first fund with room", () => {
    const dec = rows.find((r) => r.month === "2027-12")!;
    expect(dec.bonuses.map((b) => b.name)).toEqual(["13th month"]);
    expect(dec.funds.ef!.bonus).toBeGreaterThan(0);
    expect(savedThisMonth(dec, "ef")).toBe(dec.funds.ef!.amount + dec.funds.ef!.bonus);
  });

  it("totals and year ends", () => {
    expect(totalBalance(rows[23]!)).toBe(rows[23]!.funds.ef!.balance + rows[23]!.funds.travel!.balance);
    expect(yearEnds(rows).map((r) => r.month)).toEqual(["2027-12", "2028-12"]);
  });
});
