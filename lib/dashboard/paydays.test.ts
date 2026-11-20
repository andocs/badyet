import { describe, expect, it } from "vitest";
import { parsePaydays } from "./paydays";

describe("parsePaydays", () => {
  it("accepts two start days, the first before the second", () => {
    expect(parsePaydays("11", "25")).toEqual({ firstStartDay: 11, secondStartDay: 25 });
    expect(parsePaydays(" 2 ", "28")).toEqual({ firstStartDay: 2, secondStartDay: 28 });
  });
  it("rejects anything else", () => {
    for (const [a, b] of [["1", "25"], ["25", "11"], ["11", "11"], ["11", "29"], ["x", "25"], ["", ""], ["11.5", "25"], [null, "25"]]) {
      expect(parsePaydays(a, b)).toBeNull();
    }
  });
});
