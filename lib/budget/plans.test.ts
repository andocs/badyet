import { describe, expect, it } from "vitest";
import type { YearMonth } from "@/lib/domain/dates";
import { cutoffRefLabel, planFor, plansFromRows, validatePlan, type PlanSpan } from "./plans";

const ym = (s: string) => s as YearMonth;
const fall: PlanSpan = { id: "fall", name: "Fall", from: { month: ym("2026-09"), cutoff: "first" }, to: { month: ym("2026-11"), cutoff: "second" } };

describe("budget plans", () => {
  it("finds the plan in force for a cutoff, ends included", () => {
    expect(planFor([fall], ym("2026-09"), "first")).toBe("fall");
    expect(planFor([fall], ym("2026-11"), "second")).toBe("fall");
    expect(planFor([fall], ym("2026-08"), "second")).toBeNull();
    expect(planFor([fall], ym("2026-12"), "first")).toBeNull();
  });

  it("accepts a plan that starts the cutoff after another ends", () => {
    const r = validatePlan({ name: " Holidays ", from: { month: "2026-12", cutoff: "first" }, to: { month: "2027-03", cutoff: "second" } }, [fall]);
    expect(r).toEqual({ ok: true, value: { name: "Holidays", from: { month: "2026-12", cutoff: "first" }, to: { month: "2027-03", cutoff: "second" } } });
  });

  it("refuses overlaps, backwards ranges and missing names", () => {
    expect(validatePlan({ name: "X", from: { month: "2026-11", cutoff: "second" }, to: { month: "2027-01", cutoff: "first" } }, [fall])).toMatchObject({ ok: false, error: expect.stringContaining("overlaps") });
    expect(validatePlan({ name: "X", from: { month: "2027-02", cutoff: "second" }, to: { month: "2027-02", cutoff: "first" } }, [])).toMatchObject({ ok: false });
    expect(validatePlan({ name: "  ", from: { month: "2027-02", cutoff: "first" }, to: { month: "2027-02", cutoff: "second" } }, [])).toMatchObject({ ok: false });
  });

  it("lets a plan be edited without clashing with itself", () => {
    expect(validatePlan({ id: "fall", name: "Fall", from: { month: "2026-10", cutoff: "first" }, to: { month: "2026-11", cutoff: "second" } }, [fall]).ok).toBe(true);
  });

  it("reads rows and labels cutoffs", () => {
    const [p] = plansFromRows([{ id: "a", name: "A", start_month: "2026-09-01", start_cutoff: "first", end_month: "2026-11-01", end_cutoff: "second" }]);
    expect(p).toEqual({ id: "a", name: "A", from: { month: "2026-09", cutoff: "first" }, to: { month: "2026-11", cutoff: "second" } });
    expect(cutoffRefLabel(p!.to)).toBe("Nov 2026 2nd cutoff");
  });
});
