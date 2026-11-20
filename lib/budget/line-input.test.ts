import { describe, expect, it } from "vitest";
import { validateCategory, validateLine } from "./line-input";

const CAT = "11111111-1111-4111-8111-111111111111";
const ACC = "22222222-2222-4222-8222-222222222222";
const base = { name: " Groceries ", categoryId: CAT, rule: "pct", pctBp: 1300, amount: null, cutoff: "both", accountId: null, startsOn: null, endsOn: null, isDraft: false, countsToDaily: true, kind: "normal" };
const err = (x: unknown) => {
  const r = validateLine(x);
  return r.ok ? null : r.error;
};

describe("validateLine", () => {
  it("accepts a percent, a fixed and a rest line", () => {
    expect(validateLine(base)).toMatchObject({ ok: true, value: { name: "Groceries", rule: "pct", pctBp: 1300, amount: null } });
    expect(validateLine({ ...base, rule: "fixed", amount: 800_000, pctBp: null, accountId: ACC })).toMatchObject({ ok: true, value: { amount: 800_000, accountId: ACC } });
    expect(validateLine({ ...base, rule: "rest", pctBp: null })).toMatchObject({ ok: true });
  });
  it("checks the rule's own field and ranges", () => {
    expect(err({ ...base, pctBp: 10_001 })).toMatch(/0 to 100/);
    expect(err({ ...base, pctBp: 12.5 })).toMatch(/0 to 100/);
    expect(err({ ...base, rule: "fixed", amount: null })).toMatch(/amount/);
    expect(err({ ...base, rule: "fixed", amount: 1.5 })).toMatch(/amount/);
  });
  it("checks name, category, cutoff, kind and account", () => {
    expect(err({ ...base, name: "  " })).toMatch(/name/);
    expect(err({ ...base, categoryId: "x" })).toMatch(/category/i);
    expect(err({ ...base, cutoff: "third" })).toMatch(/cutoff/);
    expect(err({ ...base, kind: "rtos" })).toMatch(/counts toward/);
    expect(err({ ...base, accountId: "nope" })).toMatch(/account/);
    expect(err(null)).toMatch(/Nothing/);
  });
  it("checks start and end months", () => {
    expect(validateLine({ ...base, startsOn: "2027-03", endsOn: "2027-08" })).toMatchObject({ ok: true, value: { startsOn: "2027-03", endsOn: "2027-08" } });
    expect(err({ ...base, startsOn: "2027-3" })).toMatch(/months/);
    expect(err({ ...base, startsOn: "2027-09", endsOn: "2027-03" })).toMatch(/before/);
  });
  it("a Whatever-is-left line cannot be an office-day line", () => {
    expect(err({ ...base, rule: "rest", pctBp: null, kind: "rto" })).toMatch(/Whatever/);
  });
});

describe("validateCategory", () => {
  it("accepts a name, group and optional colour", () => {
    expect(validateCategory({ name: " Rent ", groupId: CAT, color: "#2F5BD7" })).toMatchObject({ ok: true, value: { name: "Rent", color: "#2F5BD7" } });
    expect(validateCategory({ name: "Rent", groupId: CAT })).toMatchObject({ ok: true, value: { color: null } });
  });
  it("rejects bad input", () => {
    expect(validateCategory({ name: "", groupId: CAT }).ok).toBe(false);
    expect(validateCategory({ name: "A", groupId: "x" }).ok).toBe(false);
    expect(validateCategory({ name: "A", groupId: CAT, color: "red" }).ok).toBe(false);
  });
});
