import { describe, expect, it } from "vitest";
import { yearMonth, isoDate } from "@/lib/domain/dates";
import { money } from "@/lib/domain/money";
import { allowance2, noAssumptions, p, settings, startEvent } from "@/lib/engine/fixtures";
import type { BudgetData } from "./load";
import { buildBudgetScreen, monthLabel } from "./screen";
import type { CategoryRow, GroupRow, LineRow } from "./view";

const groups: GroupRow[] = [
  { id: "g-needs", name: "Needs", feedsSavings: false },
  { id: "g-wants", name: "Wants", feedsSavings: false },
  { id: "g-save", name: "Savings", feedsSavings: true },
];
const categories: CategoryRow[] = [
  { id: "c-rent", name: "Rent", color: null, groupId: "g-needs" },
  { id: "c-food", name: "Food", color: null, groupId: "g-wants" },
  { id: "c-rest", name: "Savings", color: null, groupId: "g-save" },
];
const line = (over: Partial<LineRow> & Pick<LineRow, "id" | "categoryId">): LineRow => ({
  name: over.id, rule: "fixed", amount: p(0), cutoff: "both", feedsSavings: false, countsToDaily: false, kind: "normal", accountId: null, sort: 0, ...over,
});
const lines: LineRow[] = [
  line({ id: "rent", categoryId: "c-rent", name: "Rent", cutoff: "second", amount: p(10_000) }),
  line({ id: "food", categoryId: "c-food", name: "Food", amount: p(6_000), countsToDaily: true }),
  line({ id: "rest", categoryId: "c-rest", name: "Whatever is left", rule: "rest", feedsSavings: true }),
];

const data = (over: Partial<BudgetData> = {}): BudgetData => ({
  salary: {
    input: { events: [startEvent], allowances: [allowance2], assumptions: noAssumptions, settings, templates: [], bonusRules: [], bonusInstances: [] },
    thisMonth: yearMonth("2027-03"),
    placeable: [],
  },
  today: isoDate("2027-03-12"),
  paydays: { first: 10, second: 25 },
  period: { start: isoDate("2027-03-11"), end: isoDate("2027-03-25"), which: 1, month: yearMonth("2027-03") },
  groups, categories, lines,
  accounts: [{ id: "a1", name: "BPI" }],
  allocations: [],
  officeDays: [1, 2],
  officeDayAmount: money(0),
  overrides: new Map(),
  pools: [],
  spentByCategory: new Map([["c-food", p(1_500)]]),
  sentLineIds: new Set(),
  spendByDay: new Map(),
  ...over,
});

describe("buildBudgetScreen, this month", () => {
  const s = buildBudgetScreen(data(), { fut: false });

  it("groups the lines with this month's amounts and what has been spent", () => {
    expect(s.hasStart).toBe(true);
    expect(s.month).toBe("2027-03");
    expect(s.groups.map((g) => g.name)).toEqual(["Needs", "Wants", "Savings"]);
    const food = s.groups[1]!.lines[0]!;
    expect(food).toMatchObject({ name: "Food", amount: p(12_000), spent: { amount: p(1_500), word: "spent" } });
    expect(s.groups[0]!.lines[0]).toMatchObject({ name: "Rent", amount: p(10_000), spent: null });
  });

  it("what is left plus the planned lines equals take-home", () => {
    const planned = s.groups.flatMap((g) => g.lines).filter((l) => l.rule !== "rest").reduce((t, l) => t + (l.amount ?? 0), 0);
    expect(s.rest + planned).toBe(s.takeHome);
    expect(s.fixed).toBe(p(22_000)); // a "both cutoffs" fixed line is an amount per cutoff
    expect(s.flag).toBeNull();
    expect(s.topUpRaises).toEqual([]);
  });
});

describe("buildBudgetScreen, flags and edge cases", () => {
  it("flags a month where fixed lines are more than take-home", () => {
    const heavy = lines.map((l) => (l.id === "rent" ? { ...l, amount: p(200_000) } : l));
    const s = buildBudgetScreen(data({ lines: heavy }), { fut: false });
    expect(s.flag).toBe("over");
  });

  it("without a salary there is nothing to show", () => {
    const s = buildBudgetScreen(data({ salary: { ...data().salary, input: { ...data().salary.input, events: [] } } }), { fut: false });
    expect(s).toMatchObject({ hasStart: false, shown: null, groups: [], takeHome: 0 });
  });

  it("a bill sent shows as sent with its planned amount", () => {
    const bill = lines.map((l) => (l.id === "rent" ? { ...l, accountId: "a1", cutoff: "first" as const } : l));
    const s = buildBudgetScreen(data({ lines: bill, sentLineIds: new Set(["rent"]) }), { fut: false });
    expect(s.groups[0]!.lines[0]!.spent).toMatchObject({ word: "sent", amount: p(10_000) });
    expect(s.groups[0]!.lines[0]!.accountName).toBe("BPI");
  });
});

describe("buildBudgetScreen, future years", () => {
  it("defaults to a year from now, runs twelve months, and re-runs the rules for the chosen month", () => {
    const s = buildBudgetScreen(data(), { fut: true });
    expect(s.month).toBe("2028-03");
    expect(s.yearRun).toHaveLength(12);
    expect(s.shown?.month).toBe("2028-03");
    expect(s.groups.flatMap((g) => g.lines).every((l) => l.spent === null)).toBe(true);
  });
  it("takes a valid month and falls back for a bad one", () => {
    expect(buildBudgetScreen(data(), { fut: true, month: "2028-09" }).month).toBe("2028-09");
    expect(buildBudgetScreen(data(), { fut: true, month: "nope" }).month).toBe("2028-03");
  });
});

describe("monthLabel", () => {
  it("is short and readable", () => expect(monthLabel("2027-03")).toBe("Mar 2027"));
});
