import { describe, expect, it } from "vitest";
import { evaluateBudget } from "@/lib/engine/budget";
import { p, ym } from "@/lib/engine/fixtures";
import { buildGroups, cutoffText, groupsForCutoff, monthFlag, ruleText, type CategoryRow, type GroupRow, type LineRow } from "./view";

const groups: GroupRow[] = [{ id: "ess", name: "Essentials", feedsSavings: false }, { id: "sav", name: "Savings", feedsSavings: true }];
const categories: CategoryRow[] = [
  { id: "rent", name: "Rent", color: null, groupId: "ess" },
  { id: "food", name: "Food", color: null, groupId: "ess" },
  { id: "left", name: "Whatever is left", color: null, groupId: "sav" },
];
const line = (over: Partial<LineRow> & Pick<LineRow, "id" | "categoryId">): LineRow => ({
  name: over.id, rule: "fixed", amount: p(0), cutoff: "both", feedsSavings: false, countsToDaily: false, kind: "normal", accountId: null, sort: 0, ...over,
});
const lines: LineRow[] = [
  line({ id: "rent", categoryId: "rent", cutoff: "second", amount: p(8_000), accountId: "bpi" }),
  line({ id: "food", categoryId: "food", rule: "pct", pctBp: 1000, amount: null }),
  line({ id: "old", categoryId: "food", amount: p(500), endsOn: ym("2027-02") }),
  line({ id: "draft", categoryId: "food", amount: p(900), isDraft: true }),
  line({ id: "rest", categoryId: "left", rule: "rest", feedsSavings: true }),
];
const takeHome = { first: p(20_000), second: p(30_000) };
const budget = evaluateBudget({ month: ym("2027-03"), takeHome, lines });
const view = buildGroups({ groups, categories, lines, accounts: new Map([["bpi", "BPI Checking"]]), budget, takeHome: p(50_000), spentByLine: new Map([["food", { amount: p(300), word: "spent" as const }]]) });

describe("budget groups", () => {
  it("groups lines by their category's group with amounts from the engine", () => {
    const ess = view[0]!;
    expect(ess.lines.map((l) => l.id)).toEqual(["draft", "food", "old", "rent"].sort((a, b) => a.localeCompare(b)));
    expect(ess.lines.find((l) => l.id === "rent")).toMatchObject({ amount: p(8_000), accountName: "BPI Checking", categoryName: "Rent" });
    expect(ess.lines.find((l) => l.id === "food")).toMatchObject({ amount: p(5_000), pctBp: 1000 }); // 10% of 20,000 + 10% of 30,000
    expect(ess.total).toBe(p(13_000));
    expect(ess.share).toBeCloseTo(26);
  });

  it("keeps lines that are off this month or drafts, with no amount, so they can be edited", () => {
    const ess = view[0]!;
    expect(ess.lines.find((l) => l.id === "old")!.amount).toBeNull();
    expect(ess.lines.find((l) => l.id === "draft")).toMatchObject({ amount: null, isDraft: true });
  });

  it("carries spent so far and the rest line", () => {
    expect(view[0]!.lines.find((l) => l.id === "food")!.spent).toEqual({ amount: p(300), word: "spent" });
    expect(view[0]!.spentTotal).toBe(p(300));
    expect(view[1]!.lines[0]).toMatchObject({ id: "rest", amount: p(50_000 - 13_000) });
  });
});

describe("one cutoff", () => {
  it("shows each line at its amount in that cutoff and leaves out lines with nothing in it", () => {
    const first = groupsForCutoff(view, "first", p(20_000))[0]!;
    expect(first.lines.find((l) => l.id === "rent")).toBeUndefined(); // rent is 2nd cutoff only
    expect(first.lines.find((l) => l.id === "food")!.amount).toBe(p(2_000)); // 10% of the 1st cutoff's 20,000
    expect(first.total).toBe(p(2_000));
    expect(first.share).toBeCloseTo(10);
    const second = groupsForCutoff(view, "second", p(30_000))[0]!;
    expect(second.lines.find((l) => l.id === "rent")!.amount).toBe(p(8_000));
    expect(second.total).toBe(p(11_000));
  });
});

describe("labels and flags", () => {
  it("words the rule and cutoff", () => {
    expect(ruleText({ rule: "pct", pctBp: 1350 })).toBe("13.5% of take-home");
    expect(ruleText({ rule: "rest", pctBp: null })).toBe("Whatever is left");
    expect(ruleText({ rule: "fixed", pctBp: null })).toBe("Fixed");
    expect(cutoffText("both")).toBe("Both cutoffs");
  });
  it("flags an over or tight month", () => {
    expect(monthFlag(budget, p(2_500))).toBeNull();
    expect(monthFlag(budget, p(40_000))).toBe("tight");
    const over = evaluateBudget({ month: ym("2027-03"), takeHome, lines: [line({ id: "big", categoryId: "rent", amount: p(30_000), cutoff: "first" })] });
    expect(monthFlag(over, p(2_500))).toBe("over");
  });
});
