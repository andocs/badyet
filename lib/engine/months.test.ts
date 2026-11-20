import { describe, expect, it } from "vitest";
import { isoDate } from "@/lib/domain/dates";
import { cutoffSettingsFromPaydays, datesIn, isoWeekday, monthCutoffs, monthRange, usualOfficeDays } from "./months";
import { ym } from "./fixtures";

describe("month iterator", () => {
  it("counts months across a year end", () => {
    expect(monthRange(ym("2026-11"), 4)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(monthRange(ym("2026-11"), 0)).toEqual([]);
  });

  it("derives cutoffs from paydays the way the app does today (10th and 25th give 11 and 25)", () => {
    const s = cutoffSettingsFromPaydays(10, 25);
    expect(s).toEqual({ firstStartDay: 11, secondStartDay: 25 });
    const { first, second } = monthCutoffs(ym("2027-03"), s);
    expect([first.start, first.end]).toEqual(["2027-03-11", "2027-03-24"]);
    expect([second.start, second.end]).toEqual(["2027-03-25", "2027-04-10"]);
  });

  it("knows weekdays and counts usual office days in a cutoff", () => {
    expect(isoWeekday(isoDate("2027-03-01"))).toBe(1); // Monday
    expect(isoWeekday(isoDate("2027-03-07"))).toBe(7); // Sunday
    expect(datesIn({ start: isoDate("2027-02-27"), end: isoDate("2027-03-02") })).toHaveLength(4);
    const { first } = monthCutoffs(ym("2027-03"), cutoffSettingsFromPaydays(10, 25));
    // 11 Mar (Thu) to 24 Mar (Wed): Mon 15, Tue 16, Mon 22, Tue 23.
    expect(usualOfficeDays(first, [1, 2])).toBe(4);
  });
});
