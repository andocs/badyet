import { describe, expect, it } from "vitest";
import { isPastPlan, isUuid, isValidIsoDate, todayManila, validatePlan } from "./validate";

describe("validatePlan", () => {
  it("accepts a good plan and trims the name", () => {
    const r = validatePlan({ name: "  Dec 2026 ", startDate: "2026-12-01", endDate: "2026-12-31" });
    expect(r).toEqual({ ok: true, value: { name: "Dec 2026", startDate: "2026-12-01", endDate: "2026-12-31" } });
  });
  it("rejects empty and overlong names", () => {
    expect(validatePlan({ name: " ", startDate: "2026-12-01", endDate: "2026-12-31" }).ok).toBe(false);
    expect(validatePlan({ name: "x".repeat(61), startDate: "2026-12-01", endDate: "2026-12-31" }).ok).toBe(false);
  });
  it("rejects bad or reversed dates", () => {
    expect(validatePlan({ name: "A", startDate: "2026-02-30", endDate: "2026-03-01" }).ok).toBe(false);
    expect(validatePlan({ name: "A", startDate: "2026-12-31", endDate: "2026-12-01" }).ok).toBe(false);
    expect(validatePlan({ name: "A", startDate: undefined, endDate: 5 }).ok).toBe(false);
  });
  it("allows a one-day plan", () => {
    expect(validatePlan({ name: "A", startDate: "2026-12-01", endDate: "2026-12-01" }).ok).toBe(true);
  });
});

describe("dates", () => {
  it("validates ISO dates including leap days", () => {
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2027-02-29")).toBe(false);
    expect(isValidIsoDate("12/01/2026")).toBe(false);
  });
  it("uses the Manila calendar day", () => {
    // 2026-12-01 17:00 UTC is already Dec 2 in Manila (UTC+8)
    expect(todayManila(new Date("2026-12-01T17:00:00Z"))).toBe("2026-12-02");
    expect(todayManila(new Date("2026-12-01T15:59:00Z"))).toBe("2026-12-01");
  });
  it("treats a plan as past only after its end date", () => {
    expect(isPastPlan("2026-12-15", "2026-12-15")).toBe(false);
    expect(isPastPlan("2026-12-15", "2026-12-16")).toBe(true);
  });
});

describe("isUuid", () => {
  it("accepts uuids and rejects other text", () => {
    expect(isUuid("3f2b8c4e-1a2b-4c3d-8e9f-0123456789ab")).toBe(true);
    expect(isUuid("1; drop table plans")).toBe(false);
  });
});

describe("ongoing plans (no end date)", () => {
  it("accepts a blank end date as an ongoing plan", () => {
    const r = validatePlan({ name: "Current", startDate: "2026-12-10", endDate: "" });
    expect(r).toEqual({ ok: true, value: { name: "Current", startDate: "2026-12-10", endDate: null } });
  });
  it("still rejects a bad end date when one is given", () => {
    expect(validatePlan({ name: "A", startDate: "2026-12-10", endDate: "nope" }).ok).toBe(false);
    expect(validatePlan({ name: "A", startDate: "2026-12-10", endDate: "2026-12-01" }).ok).toBe(false);
  });
  it("never treats an ongoing plan as past", () => {
    expect(isPastPlan(null, "2099-01-01")).toBe(false);
  });
});
