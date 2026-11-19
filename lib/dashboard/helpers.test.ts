import { describe, expect, it } from "vitest";
import { currentCutoff, cutoffLabel, daysBetween, daysInMonthOf } from "./helpers";

describe("dashboard helpers", () => {
  it("picks the cutoff from the day of the month", () => {
    expect(currentCutoff("2026-12-15")).toBe("first");
    expect(currentCutoff("2026-12-16")).toBe("second");
    expect(currentCutoff("2026-12-01")).toBe("first");
  });
  it("knows month lengths including leap years", () => {
    expect(daysInMonthOf("2026-12")).toBe(31);
    expect(daysInMonthOf("2028-02")).toBe(29);
    expect(daysInMonthOf("2027-02")).toBe(28);
  });
  it("labels the cutoffs", () => {
    expect(cutoffLabel("2026-12", "first")).toBe("First cutoff · Dec 1 to 15");
    expect(cutoffLabel("2026-11", "second")).toBe("Second cutoff · Nov 16 to 30");
  });
  it("counts days between dates", () => {
    expect(daysBetween("2026-12-04", "2026-12-15")).toBe(11);
    expect(daysBetween("2026-12-15", "2026-12-04")).toBe(-11);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });
});
