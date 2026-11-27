import { describe, expect, it } from "vitest";
import { dateText, monthGrid, shiftMonth } from "./calendar";

describe("the date picker's calendar", () => {
  it("pads to the weekday of the 1st and lists every day", () => {
    const november = monthGrid("2026-11");
    expect(november.slice(0, 2)).toEqual(["2026-11-01", "2026-11-02"]); // 1 Nov 2026 is a Sunday
    expect(november).toHaveLength(30);
    expect(monthGrid("2026-12").filter((d) => d === null)).toHaveLength(2);
    expect(monthGrid("2028-02").filter(Boolean)).toHaveLength(29);
  });

  it("moves across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-05", 12)).toBe("2027-05");
  });

  it("writes a date the way the app does", () => {
    expect(dateText("2026-12-05")).toBe("5 Dec 2026");
    expect(dateText("")).toBe("");
  });
});
