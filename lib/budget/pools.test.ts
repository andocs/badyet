import { describe, expect, it } from "vitest";
import { isoDate } from "@/lib/domain/dates";
import { cutoffSettingsFromPaydays } from "@/lib/engine/months";
import { p } from "@/lib/engine/fixtures";
import { fundedCutoffs, poolBalanceNow, poolExcess } from "./pools";
import { cutoffOfficeDays, settleRows } from "./rto";

const settings = cutoffSettingsFromPaydays(10, 25); // 11-24, then 25-10
const d = isoDate;

describe("pool funding", () => {
  it("counts the cutoffs from creation to today, the current one included", () => {
    expect(fundedCutoffs(d("2027-03-15"), d("2027-03-15"), settings)).toBe(1); // inside 11-24 Mar
    expect(fundedCutoffs(d("2027-03-15"), d("2027-03-30"), settings)).toBe(2); // plus 25 Mar-10 Apr
    expect(fundedCutoffs(d("2027-03-15"), d("2027-04-12"), settings)).toBe(3); // plus 11-24 Apr
  });

  it("balance = funding + entries, and excess is what is above keep-up-to", () => {
    const bal = poolBalanceNow({
      createdOn: d("2027-03-15"), today: d("2027-04-12"), settings, perCutoff: p(1_000),
      entries: [{ kind: "use", amount: p(250) }, { kind: "settle_to_pool", amount: p(100) }, { kind: "over_from_excess", amount: p(30) }],
    });
    expect(bal).toBe(p(3_000 - 250 + 100 - 30));
    expect(poolExcess(bal, p(2_000))).toBe(p(820));
    expect(poolExcess(bal, null)).toBe(0);
    expect(poolExcess(p(500), p(2_000))).toBe(0);
  });
});

describe("office days", () => {
  const period = { start: d("2027-03-11"), end: d("2027-03-24") };
  it("marks usual days, extra days you tap on, and usual days you skip", () => {
    const days = cutoffOfficeDays(period, [1, 2], new Map([["2027-03-12", true], ["2027-03-16", false]]));
    expect(days).toHaveLength(14);
    expect(days.filter((x) => x.office).map((x) => x.date)).toEqual(["2027-03-12", "2027-03-15", "2027-03-22", "2027-03-23"]);
    expect(days.find((x) => x.date === "2027-03-12")).toMatchObject({ extra: true, usual: false });
    expect(days.find((x) => x.date === "2027-03-16")).toMatchObject({ skipped: true, office: false });
  });

  it("lists ended office days that were under or over budget, until they are settled", () => {
    const days = cutoffOfficeDays(period, [1, 2], new Map());
    const spend = new Map([["2027-03-15", p(180)], ["2027-03-16", p(310)], ["2027-03-22", p(250)], ["2027-03-17", p(999)]]);
    const rows = settleRows({ days, spendByDay: spend, dayBudget: p(250), settledDays: new Set(["2027-03-16"]), today: d("2027-03-22") });
    expect(rows.map((r) => [r.date, r.diff, r.settled])).toEqual([["2027-03-15", p(70), false], ["2027-03-16", p(-60), true]]);
    // 17 Mar was not an office day; 22 Mar is today (not ended) and on budget.
  });

  it("lists a skipped usual day that is still ahead, so you can place its money now", () => {
    const days = cutoffOfficeDays(period, [1, 2], new Map([["2027-03-23", false]]));
    const rows = settleRows({ days, spendByDay: new Map(), dayBudget: p(250), settledDays: new Set(), today: d("2027-03-20") });
    expect(rows.map((r) => [r.date, r.diff, r.skipped])).toEqual([["2027-03-23", p(250), true]]);
  });

  it("lists a usual office day you skipped, with its whole budget unused, so you can say where it goes", () => {
    const days = cutoffOfficeDays(period, [1, 2], new Map([["2027-03-16", false]]));
    const rows = settleRows({ days, spendByDay: new Map([["2027-03-15", p(250)]]), dayBudget: p(250), settledDays: new Set(), today: d("2027-03-20") });
    expect(rows.map((r) => [r.date, r.spent, r.diff, r.skipped])).toEqual([["2027-03-16", p(0), p(250), true]]);
  });
});
