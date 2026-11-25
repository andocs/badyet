import { describe, expect, it } from "vitest";
import { validateFund, validateOverride } from "./input";

const ACC = "11111111-1111-4111-8111-111111111111";
const F1 = "22222222-2222-4222-8222-222222222222";
const F2 = "33333333-3333-4333-8333-333333333333";
const ef = { name: " Emergency ", rule: "steps", tranches: [10_000_000, 20_000_000], target: 30_000_000, color: "#2F5BD7" };
const err = (x: unknown) => {
  const r = validateFund(x);
  return r.ok ? null : r.error;
};

describe("validateFund", () => {
  it("accepts steps, cap, reset and fixed funds", () => {
    expect(validateFund(ef)).toMatchObject({ ok: true, value: { name: "Emergency", tranches: [10_000_000, 20_000_000] } });
    expect(validateFund({ name: "Wants", rule: "cap", target: 2_000_000 })).toMatchObject({ ok: true });
    expect(validateFund({ name: "Long term", rule: "cap", target: null })).toMatchObject({ ok: true, value: { target: null } });
    expect(validateFund({ name: "Travel", rule: "reset", target: 5_000_000 })).toMatchObject({ ok: true, value: { resetMonth: 1 } });
    expect(validateFund({ name: "Car", rule: "fixed", fixedAmount: 300_000, target: 6_000_000 })).toMatchObject({ ok: true, value: { fixedAmount: 300_000 } });
  });
  it("each rule needs its own field", () => {
    expect(err({ name: "A", rule: "steps", tranches: [] })).toMatch(/tranche/);
    expect(err({ name: "A", rule: "steps", tranches: [0] })).toMatch(/tranche/);
    expect(err({ name: "A", rule: "reset", target: null })).toMatch(/target/);
    expect(err({ name: "A", rule: "cap", target: 0 })).toMatch(/cap/);
    expect(err({ name: "A", rule: "fixed", fixedAmount: 0 })).toMatch(/fixed/);
    expect(err({ name: "A", rule: "reset", target: 1, resetMonth: 13 })).toMatch(/month/);
  });
  it("a linked fund drops the typed balance and takes a share", () => {
    expect(validateFund({ name: "A", rule: "cap", target: 1, linkedAccountId: ACC, startBalance: 500, shareBp: 6000 })).toMatchObject({ ok: true, value: { startBalance: null, shareBp: 6000, linkedAccountId: ACC } });
    expect(err({ name: "A", rule: "cap", target: 1, linkedAccountId: ACC, shareBp: 0 })).toMatch(/share/);
    expect(err({ name: "A", rule: "cap", target: 1, linkedAccountId: "x" })).toMatch(/account/);
  });
  it("checks name, colour and amounts", () => {
    expect(err({ ...ef, name: " " })).toMatch(/name/);
    expect(err({ ...ef, color: "blue" })).toMatch(/colour/);
    expect(err({ ...ef, maxPerMonth: -1 })).toMatch(/amounts/);
    expect(err({ ...ef, rule: "pile" })).toMatch(/rule/);
    expect(err(null)).toMatch(/Nothing/);
  });
});

describe("validateOverride", () => {
  const ok = { months: ["2027-03", "2027-02", "2027-03"], order: [F2, F1], pins: { [F1]: 500_000 }, skips: [], note: " Trip " };
  it("accepts an order, pins and skips, de-duplicating and sorting the months", () => {
    expect(validateOverride(ok)).toMatchObject({ ok: true, value: { months: ["2027-02", "2027-03"], order: [F2, F1], pins: { [F1]: 500_000 }, note: "Trip" } });
    expect(validateOverride({ months: ["2027-03"], skips: [F1] })).toMatchObject({ ok: true, value: { order: null, pins: {}, skips: [F1] } });
  });
  it("rejects bad months, ids, amounts and a fund both pinned and skipped", () => {
    expect(validateOverride({ ...ok, months: [] }).ok).toBe(false);
    expect(validateOverride({ ...ok, months: ["2027-13"] }).ok).toBe(false);
    expect(validateOverride({ ...ok, order: ["x"] }).ok).toBe(false);
    expect(validateOverride({ ...ok, pins: { [F1]: -5 } }).ok).toBe(false);
    expect(validateOverride({ ...ok, skips: [F1] }).ok).toBe(false); // F1 is pinned too
  });
});
