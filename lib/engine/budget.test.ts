import { describe, expect, it } from "vitest";
import {
  dailySafeToSpend,
  evaluateBudget,
  extraOfficeDayUse,
  movedToWants,
  poolBalance,
  rtoDayBudget,
  settleOfficeDay,
  takenFromWants,
} from "./budget";
import { p, ym } from "./fixtures";
import type { BudgetLine } from "./types";

const line = (over: Partial<BudgetLine> & Pick<BudgetLine, "id">): BudgetLine => ({
  name: over.id, rule: "fixed", amount: p(0), cutoff: "both", feedsSavings: false, countsToDaily: false, kind: "normal", ...over,
});
const takeHome = { first: p(20_000), second: p(30_000) };

const lines: BudgetLine[] = [
  line({ id: "rent", cutoff: "second", amount: p(8_000) }),
  line({ id: "food", amount: p(5_000), countsToDaily: true }),
  line({ id: "save", rule: "pct", pctBp: 1000, feedsSavings: true }),
  line({ id: "rest", rule: "rest", feedsSavings: true }),
];
const amountOf = (b: ReturnType<typeof evaluateBudget>, id: string) => b.lines.find((l) => l.lineId === id)!;

describe("budget evaluator", () => {
  it("evaluates fixed, percent and rest lines per cutoff", () => {
    const b = evaluateBudget({ month: ym("2027-03"), takeHome, lines });
    expect(amountOf(b, "rent")).toMatchObject({ first: 0, second: p(8_000) });
    expect(amountOf(b, "food")).toMatchObject({ first: p(5_000), second: p(5_000) }); // "both" applies to each cutoff
    expect(amountOf(b, "save")).toMatchObject({ first: p(2_000), second: p(3_000) });
    expect(b.planned).toEqual({ first: p(7_000), second: p(16_000) });
    expect(amountOf(b, "rest")).toMatchObject({ first: p(13_000), second: p(14_000) });
    expect(b.over).toEqual({ first: false, second: false });
    expect(b.savingsPool).toBe(p(5_000 + 27_000)); // percent line + rest line
    expect(b.dailyPool).toEqual({ first: p(5_000), second: p(5_000) });
  });

  it("everything adds up to the take-home when there is a rest line and the cutoff is not over", () => {
    const b = evaluateBudget({ month: ym("2027-03"), takeHome, lines });
    expect(b.lines.reduce((t, l) => t + l.first, 0)).toBe(takeHome.first);
    expect(b.lines.reduce((t, l) => t + l.second, 0)).toBe(takeHome.second);
  });

  it("floors the rest at zero and flags 'over' when fixed and percent lines exceed take-home", () => {
    const b = evaluateBudget({ month: ym("2027-03"), takeHome, lines: [line({ id: "rent", cutoff: "second", amount: p(40_000) }), lines[3]!] });
    expect(b.over).toEqual({ first: false, second: true });
    expect(b.rest.second).toBe(0);
  });

  it("flags 'tight' when the rest falls below the threshold", () => {
    const b = evaluateBudget({ month: ym("2027-03"), takeHome, lines, tightBelow: p(13_500) });
    expect(b.tight).toEqual({ first: true, second: false });
  });

  it("turns a line on only between its start and end months, and leaves out drafts", () => {
    const timed = [
      line({ id: "loan", amount: p(1_000), endsOn: ym("2027-02") }),
      line({ id: "gym", amount: p(500), startsOn: ym("2027-04") }),
      line({ id: "idea", amount: p(900), isDraft: true }),
    ];
    const ids = (m: string, includeDrafts = false) => evaluateBudget({ month: ym(m), takeHome, lines: timed, includeDrafts }).lines.map((l) => l.lineId);
    expect(ids("2027-02")).toEqual(["loan"]);
    expect(ids("2027-03")).toEqual([]);
    expect(ids("2027-04")).toEqual(["gym"]);
    expect(ids("2027-04", true)).toEqual(["gym", "idea"]);
  });

  it("adds raise top-ups from the event's month on, by amount or as a share of the extra take-home", () => {
    const base = {
      takeHome,
      lines: [line({ id: "travel", amount: p(0) }), line({ id: "rest", rule: "rest" })],
      events: [{ id: "e1", effectiveMonth: ym("2027-03") }],
      allocations: [
        { salaryEventId: "e1", budgetLineId: "travel", mode: "amount" as const, amount: p(500) },
        { salaryEventId: "e1", budgetLineId: "travel", mode: "percent" as const, pctBp: 5000 },
      ],
      raiseExtras: { e1: { first: p(1_000), second: p(1_500) } },
    };
    const after = amountOf(evaluateBudget({ month: ym("2027-03"), ...base }), "travel");
    expect(after.first).toBe(p(500 + 500));
    expect(after.second).toBe(p(500 + 750));
    expect(after.topUps).toHaveLength(2);
    const before = amountOf(evaluateBudget({ month: ym("2027-02"), ...base }), "travel");
    expect(before).toMatchObject({ first: 0, second: 0, topUps: [] });
    // The rest line gives up exactly what the top-ups took.
    expect(amountOf(evaluateBudget({ month: ym("2027-03"), ...base }), "rest").first).toBe(p(20_000 - 1_000));
  });
});

describe("office days and pools", () => {
  it("derives the day budget from the RTO lines and the usual office days, never typed", () => {
    expect(rtoDayBudget(p(12_000), 4)).toBe(p(3_000));
    expect(rtoDayBudget(p(12_000), 0)).toBe(0);
    const b = evaluateBudget({
      month: ym("2027-03"), takeHome,
      lines: [line({ id: "rto1", kind: "rto", cutoff: "first", amount: p(8_000) }), line({ id: "rto2", kind: "rto", cutoff: "first", amount: p(4_000) }), line({ id: "cont", kind: "rto_contingency", cutoff: "first", amount: p(2_000), countsToDaily: true })],
    });
    expect(b.rtoTotal).toEqual({ first: p(12_000), second: 0 });
    expect(b.dailyPool.first).toBe(0); // the contingency line has its own pool, not the daily amount
  });

  it("settles an office day: under goes to the pool or Wants, over comes from Wants or the pool's excess", () => {
    expect(settleOfficeDay({ budget: p(3_000), spent: p(2_200), underTo: "pool", overFrom: "wants" })).toEqual({ kind: "settle_to_pool", amount: p(800) });
    expect(settleOfficeDay({ budget: p(3_000), spent: p(2_200), underTo: "wants", overFrom: "wants" })).toEqual({ kind: "settle_to_wants", amount: p(800) });
    expect(settleOfficeDay({ budget: p(3_000), spent: p(3_500), underTo: "pool", overFrom: "wants" })).toEqual({ kind: "over_from_wants", amount: p(500) });
    expect(settleOfficeDay({ budget: p(3_000), spent: p(3_500), underTo: "pool", overFrom: "excess" })).toEqual({ kind: "over_from_excess", amount: p(500) });
    expect(settleOfficeDay({ budget: p(3_000), spent: p(3_000), underTo: "pool", overFrom: "wants" })).toBeNull();
  });

  it("computes a pool's balance from its entries", () => {
    const entries = [
      { kind: "fund" as const, amount: p(5_000) },
      extraOfficeDayUse(p(3_000)),
      { kind: "settle_to_pool" as const, amount: p(800) },
      { kind: "over_from_excess" as const, amount: p(200) },
      { kind: "to_wants" as const, amount: p(100) },
      { kind: "settle_to_wants" as const, amount: p(300) }, // does not pass through the pool
    ];
    expect(poolBalance(entries)).toBe(p(2_500));
    expect(movedToWants(entries)).toBe(p(400));
    expect(takenFromWants([{ kind: "over_from_wants", amount: p(500) }])).toBe(p(500));
  });

  it("works out the daily safe-to-spend, adding the office-day amount on a usual office day", () => {
    const base = { dailyPool: p(15_000), confirmedSpend: p(3_000), movedToWants: p(500), daysLeft: 10 };
    expect(dailySafeToSpend(base)).toBe(p(1_250));
    expect(dailySafeToSpend({ ...base, officeDayAmount: p(300), isUsualOfficeDay: true })).toBe(p(1_550));
    expect(dailySafeToSpend({ ...base, confirmedSpend: p(99_000) })).toBe(0);
    expect(dailySafeToSpend({ ...base, daysLeft: 0 })).toBe(p(12_500));
  });

  it("takes a different amount in each cutoff when the line says so", () => {
    const b = evaluateBudget({ month: ym("2027-03"), takeHome, lines: [line({ id: "save", amount: p(5_000), amountSecond: p(10_000) }), line({ id: "plain", amount: p(1_000) })] });
    expect(amountOf(b, "save")).toMatchObject({ first: p(5_000), second: p(10_000), total: p(15_000) });
    expect(amountOf(b, "plain")).toMatchObject({ first: p(1_000), second: p(1_000) });
    expect(b.planned).toEqual({ first: p(6_000), second: p(11_000) });
  });

  it("ignores the second amount unless the line is on both cutoffs", () => {
    const b = evaluateBudget({ month: ym("2027-03"), takeHome, lines: [line({ id: "x", cutoff: "second", amount: p(5_000), amountSecond: p(9_000) })] });
    expect(amountOf(b, "x")).toMatchObject({ first: 0, second: p(5_000) });
  });

  it("adds a reimbursement to the cutoff it is deposited in", () => {
    const wifi = line({ id: "wifi", cutoff: "first", amount: p(2_099), reimburse: { amount: p(2_099), cutoff: "first", day: 17 } });
    const b = evaluateBudget({ month: ym("2027-03"), takeHome, lines: [wifi, line({ id: "rest", rule: "rest", feedsSavings: true })] });
    expect(b.reimbursed).toEqual({ first: p(2_099), second: 0 });
    // The bill is planned, the deposit gives it back, so the first cutoff has all of its take-home left.
    expect(amountOf(b, "rest").first).toBe(p(20_000));
    expect(b.over.first).toBe(false);
  });

  it("does not count a reimbursement from a line that is off this month", () => {
    const wifi = line({ id: "wifi", cutoff: "first", amount: p(2_099), endsOn: ym("2027-02"), reimburse: { amount: p(2_099), cutoff: "first" } });
    expect(evaluateBudget({ month: ym("2027-03"), takeHome, lines: [wifi] }).reimbursed).toEqual({ first: 0, second: 0 });
  });
});
