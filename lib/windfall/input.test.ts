import { describe, expect, it } from "vitest";
import { parseEventForm } from "./input";

const base = { kind: "thirteenth", name: "13th month", cutoff: "first", payDate: "2026-12-15" };

describe("parseEventForm", () => {
  it("lets a 13th month leave gross blank (defaults to a month of basic)", () => {
    const r = parseEventForm({ ...base, gross: "" });
    expect(r.ok && r.value.gross).toBeNull();
  });
  it("requires gross for a bonus", () => {
    expect(parseEventForm({ ...base, kind: "bonus", gross: "" }).ok).toBe(false);
    const r = parseEventForm({ ...base, kind: "bonus", gross: "25,000" });
    expect(r.ok && r.value.gross).toBe(2_500_000);
  });
  it("parses CIP inputs into integer ratios", () => {
    const r = parseEventForm({ ...base, kind: "cip", cipEligible: "600,000", cipComponentPct: "13.81505", cipMultiplier: "1.25" });
    expect(r.ok && r.value.cipComponentNum).toBe(1_381_505);
    expect(r.ok && r.value.cipMultiplierNum).toBe(125);
    expect(r.ok && r.value.cipEligible).toBe(60_000_000);
  });
  it("rejects incomplete or bad CIP and bad common fields", () => {
    expect(parseEventForm({ ...base, kind: "cip" }).ok).toBe(false);
    expect(parseEventForm({ ...base, kind: "cip", cipEligible: "1", cipComponentPct: "abc", cipMultiplier: "1" }).ok).toBe(false);
    expect(parseEventForm({ ...base, name: "" }).ok).toBe(false);
    expect(parseEventForm({ ...base, payDate: "2026-02-30" }).ok).toBe(false);
    expect(parseEventForm({ ...base, cutoff: "third" }).ok).toBe(false);
    expect(parseEventForm({ ...base, kind: "other" }).ok).toBe(false);
  });
});

describe("de minimis input", () => {
  const base = { kind: "bonus", name: "September bonus", cutoff: "first", payDate: "2027-09-30", gross: "60,000" };
  it("reads an optional de minimis for a bonus and defaults to none", () => {
    const r = parseEventForm({ ...base, deMinimis: "12,000" });
    expect(r.ok && r.value.deMinimis).toBe(1_200_000);
    const none = parseEventForm(base);
    expect(none.ok && none.value.deMinimis).toBe(0);
  });
  it("refuses a de minimis on the 13th month, bigger than the bonus, or malformed", () => {
    expect(parseEventForm({ ...base, kind: "thirteenth", gross: "", deMinimis: "1,000" }).ok).toBe(false);
    expect(parseEventForm({ ...base, deMinimis: "70,000" }).ok).toBe(false);
    expect(parseEventForm({ ...base, deMinimis: "abc" }).ok).toBe(false);
    expect(parseEventForm({ ...base, deMinimis: "-5" }).ok).toBe(false);
  });
});
