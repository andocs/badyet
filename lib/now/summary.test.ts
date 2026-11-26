import { describe, expect, it } from "vitest";
import { isoDate } from "@/lib/domain/dates";
import { evaluateBudget } from "@/lib/engine/budget";
import { p, ym } from "@/lib/engine/fixtures";
import { buildNowView, currentCutoff, manilaDate, type NowCategory, type NowLine, type NowTxn } from "./summary";

const line = (over: Partial<NowLine> & Pick<NowLine, "id" | "categoryId">): NowLine => ({
  name: over.id, rule: "fixed", amount: p(0), cutoff: "both", feedsSavings: false, countsToDaily: false, kind: "normal", accountId: null, ...over,
});
const categories: NowCategory[] = [
  { id: "food", name: "Food", color: null, feedsSavings: false },
  { id: "transport", name: "Commute", color: "#123456", feedsSavings: false },
  { id: "housing", name: "Rent", color: null, feedsSavings: false },
  { id: "stash", name: "Stash", color: null, feedsSavings: true },
];
const lines: NowLine[] = [
  line({ id: "food", categoryId: "food", amount: p(7_000), countsToDaily: true }),
  line({ id: "commute", categoryId: "transport", amount: p(2_800), countsToDaily: true }),
  line({ id: "rent", categoryId: "housing", cutoff: "second", amount: p(8_000), accountId: "acc1" }),
  line({ id: "stashline", categoryId: "stash", amount: p(900), accountId: "acc2", feedsSavings: true }),
  line({ id: "rest", categoryId: "stash", rule: "rest", feedsSavings: true }),
];
const txn = (over: Partial<NowTxn> & Pick<NowTxn, "id" | "occurredAt" | "amount">): NowTxn => ({
  merchant: null, categoryId: null, budgetLineId: null, accountName: "GCash", kind: "expense", status: "confirmed", ...over,
});
const txns: NowTxn[] = [
  txn({ id: "a", occurredAt: "2027-03-12T10:00:00+08:00", amount: p(-1_400), categoryId: "food", merchant: "Market" }),
  txn({ id: "b", occurredAt: "2027-03-16T20:00:00+08:00", amount: p(-700), categoryId: "food" }),
  txn({ id: "c", occurredAt: "2027-03-17T08:00:00+08:00", amount: p(-400), categoryId: "transport" }),
  txn({ id: "d", occurredAt: "2027-03-17T09:00:00+08:00", amount: p(-300), categoryId: "food", status: "pending" }),
  txn({ id: "e", occurredAt: "2027-03-17T09:30:00+08:00", amount: p(-999), categoryId: "food", status: "ignored" }),
  txn({ id: "f", occurredAt: "2027-03-11T09:00:00+08:00", amount: p(900), kind: "transfer", budgetLineId: "stashline" }),
];
const takeHome = { first: p(20_000), second: p(30_000) };
const base = (today: string) => ({
  today: isoDate(today),
  paydays: { first: 10, second: 25 },
  officeDays: [1, 2],
  officeDayAmount: p(300),
  budget: evaluateBudget({ month: ym("2027-03"), takeHome, lines }),
  lines,
  categories,
  txns,
});

describe("cutoff of today", () => {
  it("uses the paydays the way the app does (11 to 24, then 25 to the 10th)", () => {
    const a = currentCutoff(isoDate("2027-03-17"), { first: 10, second: 25 });
    expect([a.period.start, a.period.end, a.cutoff, a.budgetMonth]).toEqual(["2027-03-11", "2027-03-24", "first", "2027-03"]);
    const b = currentCutoff(isoDate("2027-04-05"), { first: 10, second: 25 });
    expect([b.period.start, b.period.end, b.cutoff, b.budgetMonth]).toEqual(["2027-03-25", "2027-04-10", "second", "2027-03"]);
  });
  it("reads a Manila date from a timestamp", () => {
    expect(manilaDate("2027-03-16T20:00:00Z")).toBe("2027-03-17");
    expect(manilaDate("2027-03-16T20:00:00+08:00")).toBe("2027-03-16");
  });
});

describe("Now view", () => {
  const v = buildNowView(base("2027-03-17"));

  it("works out safe to spend from the daily lines, confirmed spend and days left", () => {
    expect([v.daysTotal, v.dayNumber, v.daysLeft]).toEqual([14, 7, 8]);
    expect(v.pool).toBe(p(9_800));
    expect(v.spent).toBe(p(2_500)); // pending and ignored rows do not count
    expect(v.left).toBe(p(7_300));
    expect(v.perDay).toBe(p(912.5)); // 7,300 over 8 days
    expect(v.today).toBe(v.perDay); // Wednesday is not a usual office day
    expect(v.nextPayday).toBe("2027-03-25");
  });

  it("adds the office-day amount on a usual office day and shows the next one", () => {
    expect(v.nextOffice).toEqual({ date: "2027-03-22", amount: p(1_212.5) });
    const monday = buildNowView(base("2027-03-15"));
    expect(monday.isUsualOfficeDay).toBe(true);
    expect(monday.today).toBe(monday.perDay + p(300));
  });

  it("compares spend with the plan pace and gives a cumulative runway", () => {
    expect(v.pace).toBe(p(4_900)); // 9,800 x 7 / 14
    expect(v.overPace).toBe(p(-2_400));
    expect(v.cumulative).toEqual([0, 0, p(1_400), p(1_400), p(1_400), p(1_400), p(2_100), p(2_500)]);
  });

  it("makes an envelope per category that has a plan this cutoff and is not a savings category", () => {
    expect(v.envelopes.map((e) => e.name)).toEqual(["Food", "Commute", "Wants"]); // Rent is second cutoff; Stash feeds savings; Wants is the money left after every line
    const food = v.envelopes[0]!;
    expect(food).toMatchObject({ plan: p(7_000), spent: p(2_100), left: p(4_900), pace: p(3_500), overPace: p(-1_400) });
    expect(food.txns.map((t) => t.id)).toEqual(["d", "b", "a"]); // newest first, ignored left out, pending shown
    expect(v.envelopes[1]!.color).toBe("#123456");
  });

  it("adds a Wants row from what is left after every line, plus what office days sent to Wants and less what they took", () => {
    // First cutoff: 20,000 take-home less food 7,000, commute 2,800 and stash 900 leaves 9,300.
    expect(v.envelopes.find((e) => e.name === "Wants")).toMatchObject({ plan: p(9_300), spent: 0 });
    const more = buildNowView({ ...base("2027-03-17"), movedToWants: p(250), takenFromWants: p(50) });
    expect(more.envelopes.find((e) => e.name === "Wants")!.plan).toBe(p(9_500));
    // The hero counts the same money: "left of" includes it, so it agrees with the amount per day.
    const plain = buildNowView(base("2027-03-17"));
    expect([more.pool - plain.pool, more.left - plain.left, more.movedIn, plain.movedIn]).toEqual([p(200), p(200), p(200), 0]);
    expect(more.perDay).toBeGreaterThan(plain.perDay);
  });

  it("counts spending in the categories of the Wants group against that row", () => {
    const cats = [...categories, { id: "fun", name: "Fun", color: null, feedsSavings: false, groupName: "Wants" }];
    const t = [...txns, txn({ id: "w1", occurredAt: "2027-03-15T04:00:00Z", amount: p(-400), categoryId: "fun" })];
    const wants = buildNowView({ ...base("2027-03-17"), categories: cats, txns: t }).envelopes.find((e) => e.name === "Wants")!;
    expect(wants).toMatchObject({ plan: p(9_300), spent: p(400), left: p(8_900) });
    expect(wants.txns.map((x) => x.id)).toEqual(["w1"]);
  });

  it("lists bills and transfers with their sent state", () => {
    expect(v.bills).toMatchObject([{ lineId: "stashline", name: "stashline", amount: p(900), sent: true }]);
    expect(v.bills[0]!.txnId).not.toBeNull();
    expect(v.billsTotalSent).toBe(p(900));
  });

  it("lists recent activity newest first without ignored rows, and counts pending", () => {
    expect(v.recent.map((t) => t.id)).toEqual(["d", "c", "b", "a", "f"]);
    expect(v.pendingCount).toBe(1);
  });

  it("handles a second cutoff that runs into the next month", () => {
    const s = buildNowView({ ...base("2027-03-30"), txns: [] });
    expect([s.period.start, s.period.end, s.cutoff, s.daysTotal]).toEqual(["2027-03-25", "2027-04-10", "second", 17]);
    expect(s.nextPayday).toBe("2027-04-10");
    expect(s.bills.map((b) => b.name)).toEqual(["rent", "stashline"]);
    expect(s.spent).toBe(0);
  });
});
