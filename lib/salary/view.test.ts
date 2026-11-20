import { describe, expect, it } from "vitest";
import { allowance2, noAssumptions, p, settings, startEvent, ym } from "@/lib/engine/fixtures";
import type { BonusRule, SalaryEvent } from "@/lib/engine/types";
import { eventEffect, eventRows, regularRange, yearRows, type SalaryInput } from "./view";

const thirteenth: BonusRule = {
  id: "t13", payslipCutoff: "second", recurrence: "yearly", kind: "thirteenth", name: "13th month", payMonth: 12, formula: "base_multiple",
  baseMultipleBp: 10000, deMinimis: p(0), splits: [],
};
const merit: SalaryEvent = { id: "m", effectiveMonth: ym("2027-03"), kind: "merit", pctBp: 500, status: "confirmed" };
const promo: SalaryEvent = { id: "p", effectiveMonth: ym("2027-07"), kind: "promotion", newBase: p(60_000), status: "expected" };

const input: SalaryInput = {
  events: [startEvent, merit, promo],
  allowances: [allowance2],
  assumptions: noAssumptions,
  settings,
  templates: [],
  bonusRules: [thirteenth],
  bonusInstances: [],
};

describe("salary view", () => {
  it("gives regular pay per month without bonuses", () => {
    const r = regularRange(input, ym("2027-06"), 3);
    expect(r.map((x) => x.salary.base)).toEqual([p(52_500), p(60_000), p(60_000)]);
    expect(r[1]!.salary.expected).toBe(true);
    expect(r[0]!.pay.takeHome).toBe(r[0]!.pay.first.takeHome + r[0]!.pay.second.takeHome);
  });

  it("works out each event's effect on monthly take-home", () => {
    const rows = eventRows(input);
    expect(rows.map((r) => r.event.id)).toEqual(["start", "m", "p"]);
    expect(rows[0]!.delta).toBeNull();
    expect(rows[1]!.delta!).toBeGreaterThan(0);
    expect(rows[2]!.delta!).toBeGreaterThan(rows[1]!.delta!); // 7,500 more base beats 2,500 more
  });

  it("makes one row a year from December, with that year's bonuses after tax", () => {
    const [y26, y27] = yearRows(input, [2026, 2027]);
    expect(y26).toMatchObject({ year: 2026, base: p(50_000), bonusNet: p(50_000), assumed: false });
    expect(y27!.base).toBe(p(60_000));
    expect(y27!.bonusNet).toBe(p(60_000)); // the 13th month follows the new base
    expect(y27!.first + y27!.second).toBeGreaterThan(y26!.first + y26!.second);
  });

  it("shows what adding an event does, per month and over five years, with the bonus part", () => {
    const before: SalaryInput = { ...input, events: [startEvent, merit] };
    const e = eventEffect(before, input, ym("2027-07"));
    expect(e.perMonth).toBeGreaterThan(0);
    expect(e.total).toBeGreaterThan(e.perMonth * 59); // 60 months of the raise, plus bigger 13th months
    expect(e.bonusPart).toBeGreaterThan(0);
  });

  it("an event that changes nothing has no effect", () => {
    const e = eventEffect(input, input, ym("2027-07"));
    expect(e).toEqual({ perMonth: 0, total: 0, bonusPart: 0 });
  });
});
