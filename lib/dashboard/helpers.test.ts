import { describe, expect, it } from "vitest";
import { currentPeriod, cutoffLabel, cutoffRange, daysBetween, nextPayday, resolveCutoff } from "./helpers";

describe("pay-date cutoffs (paydays on the 10th and 25th: 11 to 24, then 25 to the 10th)", () => {
  it("puts a date in the cutoff it falls in, and names the month the cutoff started in", () => {
    expect(currentPeriod("2026-12-11")).toEqual({ month: "2026-12", cutoff: "first" });
    expect(currentPeriod("2026-12-24")).toEqual({ month: "2026-12", cutoff: "first" });
    expect(currentPeriod("2026-12-25")).toEqual({ month: "2026-12", cutoff: "second" });
    expect(currentPeriod("2026-12-31")).toEqual({ month: "2026-12", cutoff: "second" });
    // the second cutoff runs over the month end: Jan 1 to 10 still belong to December's second cutoff
    expect(currentPeriod("2027-01-05")).toEqual({ month: "2026-12", cutoff: "second" });
    expect(currentPeriod("2027-01-10")).toEqual({ month: "2026-12", cutoff: "second" });
    expect(currentPeriod("2027-01-11")).toEqual({ month: "2027-01", cutoff: "first" });
  });
  it("crosses the year end and short months", () => {
    expect(currentPeriod("2027-01-01").month).toBe("2026-12");
    expect(currentPeriod("2027-03-03")).toEqual({ month: "2027-02", cutoff: "second" });
  });
  it("uses a valid URL value, otherwise the cutoff you are in today", () => {
    expect(resolveCutoff("first", "2026-12-26")).toBe("first");
    expect(resolveCutoff(undefined, "2026-12-26")).toBe("second");
    expect(resolveCutoff("nope", "2026-12-15")).toBe("first");
  });
  it("labels the date range, including one that crosses a month", () => {
    expect(cutoffLabel("2026-12", "first")).toBe("First cutoff · Dec 11 to Dec 24");
    expect(cutoffLabel("2026-12", "second")).toBe("Second cutoff · Dec 25 to Jan 10");
    expect(cutoffRange("2026-12", "second")).toEqual({ start: "2026-12-25", end: "2027-01-10" });
  });
  it("follows other payday settings", () => {
    const rule = { firstStartDay: 6, secondStartDay: 21 };
    expect(currentPeriod("2026-12-05", rule)).toEqual({ month: "2026-11", cutoff: "second" });
    expect(cutoffLabel("2026-12", "first", rule)).toBe("First cutoff · Dec 6 to Dec 20");
  });
  it("finds the next payday after today", () => {
    expect(nextPayday("2026-12-15")).toEqual({ start: "2026-12-25", month: "2026-12", cutoff: "second" });
    expect(nextPayday("2026-12-26")).toEqual({ start: "2027-01-11", month: "2027-01", cutoff: "first" });
    expect(nextPayday("2027-01-05")).toEqual({ start: "2027-01-11", month: "2027-01", cutoff: "first" });
  });
});

describe("daysBetween", () => {
  it("counts days between dates", () => {
    expect(daysBetween("2026-12-04", "2026-12-15")).toBe(11);
    expect(daysBetween("2026-12-15", "2026-12-04")).toBe(-11);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });
});
