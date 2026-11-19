import { describe, expect, it } from "vitest";
import { formatRange } from "./format";

describe("formatRange", () => {
  it("shows the year once for a same-year range", () => {
    expect(formatRange("2026-12-01", "2026-12-31")).toBe("Dec 1 to Dec 31, 2026");
  });
  it("shows both years across a year boundary", () => {
    expect(formatRange("2026-12-16", "2027-01-15")).toBe("Dec 16, 2026 to Jan 15, 2027");
  });
});
