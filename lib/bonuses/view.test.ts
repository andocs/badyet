import { describe, expect, it } from "vitest";
import { noAssumptions, p, settings, startEvent, ym } from "@/lib/engine/fixtures";
import type { BonusRule } from "@/lib/engine/types";
import type { SalaryInput } from "@/lib/salary/view";
import { bonusCards, destName, yearSummary, type SavedSplit } from "./view";

const FUND = "22222222-2222-4222-8222-222222222222";
const thirteenth: BonusRule = {
  id: "t13", payslipCutoff: "second", recurrence: "yearly", kind: "thirteenth", name: "13th month", payMonth: 12, formula: "base_multiple",
  baseMultipleBp: 10000, deMinimis: p(0), splits: [{ targetKind: "fund", targetId: FUND, mode: "percent", pctBp: 5000 }, { targetKind: "gift", label: "Gifts", mode: "amount", amount: p(10_000) }],
};
const cip: BonusRule = {
  id: "cip", payslipCutoff: "first", recurrence: "yearly", kind: "cip", name: "CIP", payMonth: 3, formula: "eligible_x_component_x_multiplier",
  eligibleAmount: p(400_000), eligibleRefYear: 2026, componentNum: 1_381_505, deMinimis: p(12_000), splits: [],
};
const input: SalaryInput = { events: [startEvent], allowances: [], assumptions: noAssumptions, settings, templates: [], bonusRules: [cip, thirteenth], bonusInstances: [] };

describe("bonus cards", () => {
  const cards = bonusCards(2026, input, new Map());

  it("lists the year's bonuses in pay-month order with the waterfall from gross to net", () => {
    expect(cards.map((c) => c.name)).toEqual(["CIP", "13th month"]);
    const [c, t] = cards;
    expect(c).toMatchObject({ gross: p(69_075.25), deMinimis: p(12_000), exempt: p(57_075.25), over: 0, tax: 0, net: p(69_075.25), roomBefore: p(90_000) });
    // The 13th month lands after CIP, so it has only what is left of the shared ₱90,000 cap.
    expect(t!.roomBefore).toBe(p(90_000 - 57_075.25));
    expect(t!.exempt).toBe(t!.roomBefore);
    expect(t!.over).toBe(p(50_000) - t!.exempt);
    expect(t!.tax).toBeGreaterThan(0);
    expect(t!.net).toBe(p(50_000) - t!.tax);
  });

  it("uses the rule's default splits (a percent of the net and a flat amount) until you save your own", () => {
    const t = cards[1]!;
    expect(t.dests.map((d) => [d.name, d.kind])).toEqual([["General savings", "fund"], ["Gifts", "gift"]]);
    expect(t.dests[1]!.amount).toBe(p(10_000));
    expect(t.dests[0]!.amount + t.dests[1]!.amount + t.unplaced).toBe(t.net);
    expect(cards[0]!.unplaced).toBe(cards[0]!.net); // CIP has no default splits yet
  });

  it("prefers saved destinations, with their done ticks", () => {
    const saved = new Map<string, SavedSplit[]>([["cip|2026", [{ kind: "purchase", targetId: null, label: "Laptop", amount: p(60_000), done: true }]]]);
    const c = bonusCards(2026, input, saved)[0]!;
    expect(c.dests).toEqual([{ kind: "purchase", targetId: null, label: "Laptop", name: "Laptop", amount: p(60_000), done: true }]);
    expect(c.unplaced).toBe(p(69_075.25 - 60_000));
  });

  it("a received bonus shows what was planned beside what arrived", () => {
    const withReceived: SalaryInput = { ...input, bonusInstances: [{ ruleId: "cip", year: 2026, status: "received", grossActual: p(64_000), deMinimisActual: p(12_000), netActual: p(64_000) }] };
    const c = bonusCards(2026, withReceived, new Map())[0]!;
    expect(c).toMatchObject({ status: "received", gross: p(64_000), net: p(64_000), plannedNet: p(69_075.25) });
  });

  it("summarises the year", () => {
    const s = yearSummary(cards);
    expect(s.count).toBe(2);
    expect(s.net).toBe(cards[0]!.net + cards[1]!.net);
    expect(s.gross).toBe(p(69_075.25 + 50_000));
    expect(s.tax).toBe(s.gross - s.net);
    expect(s.byDest.map((d) => d.name)).toEqual(["General savings", "Gifts"]); // biggest first
  });

  it("names destinations", () => {
    expect(destName("fund", "Old fund")).toBe("General savings");
    expect(destName("fund", null)).toBe("General savings");
    expect(destName("debt", null)).toBe("Debt");
    expect(destName("gift", "Mom's birthday")).toBe("Mom's birthday");
  });
});
