import { describe, expect, it } from "vitest";
import { currentMonth, isMonth, monthLabel, shiftMonth } from "./month";

describe("months", () => {
  it("validates YYYY-MM", () => {
    expect(isMonth("2026-12")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-1")).toBe(false);
    expect(isMonth(undefined)).toBe(false);
  });
  it("shifts across year boundaries", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftMonth("2026-05", 0)).toBe("2026-05");
  });
  it("labels months", () => {
    expect(monthLabel("2026-12")).toBe("Dec 2026");
  });
  it("uses the Manila month", () => {
    expect(currentMonth(new Date("2026-11-30T17:00:00Z"))).toBe("2026-12");
  });
});
