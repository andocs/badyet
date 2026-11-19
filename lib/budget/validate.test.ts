import { describe, expect, it } from "vitest";
import { isBucket, isCutoff, validateLine } from "./validate";

describe("validateLine", () => {
  it("parses a name and amount into centavos", () => {
    expect(validateLine({ name: " Transpo ", amount: "2,400" })).toEqual({ ok: true, value: { name: "Transpo", amount: 240_000 } });
  });
  it("allows negative amounts for reimbursements", () => {
    const r = validateLine({ name: "PLDT reimbursed", amount: "-2,099.00" });
    expect(r.ok && r.value.amount).toBe(-209_900);
  });
  it("rejects empty or overlong names", () => {
    expect(validateLine({ name: "", amount: "5" }).ok).toBe(false);
    expect(validateLine({ name: "x".repeat(61), amount: "5" }).ok).toBe(false);
  });
  it("rejects bad or absurd amounts", () => {
    expect(validateLine({ name: "A", amount: "abc" }).ok).toBe(false);
    expect(validateLine({ name: "A", amount: "" }).ok).toBe(false);
    expect(validateLine({ name: "A", amount: "999,999,999,999" }).ok).toBe(false);
  });
});

describe("guards", () => {
  it("only accepts known cutoffs and buckets", () => {
    expect(isCutoff("first") && isCutoff("second")).toBe(true);
    expect(isCutoff("third")).toBe(false);
    expect(isBucket("wants")).toBe(true);
    expect(isBucket("other")).toBe(false);
  });
});
