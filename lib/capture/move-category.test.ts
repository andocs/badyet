import { describe, expect, it } from "vitest";
import { isMoveCategory } from "./transfer-category";

describe("isMoveCategory", () => {
  it("treats Transfer and Credit card payment as moves between your own accounts", () => {
    expect(isMoveCategory("Transfer")).toBe(true);
    expect(isMoveCategory("Credit card payment")).toBe(true);
    expect(isMoveCategory("Groceries")).toBe(false);
    expect(isMoveCategory(null)).toBe(false);
  });
});
