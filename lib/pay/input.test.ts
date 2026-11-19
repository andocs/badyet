import { describe, expect, it } from "vitest";
import { parsePayForm } from "./input";

const good = { annualBase: "600,000", allowanceSecond: "2,000", sss: "1,750", pagibig: "200", savingsPlanPercent: "6" };

describe("parsePayForm", () => {
  it("parses a full form into centavos and basis points", () => {
    const r = parsePayForm(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.annualBase).toBe(60_000_000);
      expect(r.value.savingsPlanBp).toBe(600);
      expect(r.value.philhealthOverride).toBeNull();
    }
  });
  it("treats blank optional fields as zero or no override", () => {
    const r = parsePayForm({ annualBase: "100000" });
    expect(r.ok && r.value.sss).toBe(0);
    expect(r.ok && r.value.taxOverrideFirst).toBeNull();
  });
  it("keeps an explicit zero override (different from blank)", () => {
    const r = parsePayForm({ ...good, taxOverrideFirst: "0" });
    expect(r.ok && r.value.taxOverrideFirst).toBe(0);
  });
  it("rejects a missing or zero annual base", () => {
    expect(parsePayForm({ ...good, annualBase: "" }).ok).toBe(false);
    expect(parsePayForm({ ...good, annualBase: "0" }).ok).toBe(false);
  });
  it("rejects junk, negatives and absurd amounts", () => {
    expect(parsePayForm({ ...good, sss: "abc" }).ok).toBe(false);
    expect(parsePayForm({ ...good, sss: "-5" }).ok).toBe(false);
    expect(parsePayForm({ ...good, annualBase: "999,999,999,999" }).ok).toBe(false);
  });
  it("validates the savings plan percent", () => {
    expect(parsePayForm({ ...good, savingsPlanPercent: "6.5" }).ok).toBe(true);
    expect(parsePayForm({ ...good, savingsPlanPercent: "101" }).ok).toBe(false);
    expect(parsePayForm({ ...good, savingsPlanPercent: "six" }).ok).toBe(false);
  });
});
