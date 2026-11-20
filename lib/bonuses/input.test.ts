import { describe, expect, it } from "vitest";
import { validateInstance, validateRule } from "./input";

const RULE = "11111111-1111-4111-8111-111111111111";
const FUND = "22222222-2222-4222-8222-222222222222";
const base = { name: " 13th month ", recurrence: "yearly", kind: "thirteenth", payMonth: 12, cutoff: "second", formula: "base_multiple", baseMultipleBp: 10000, deMinimis: 0 };
const ruleErr = (x: unknown) => {
  const r = validateRule(x);
  return r.ok ? null : r.error;
};

describe("validateRule", () => {
  it("accepts a 13th month, a CIP and a one-off", () => {
    expect(validateRule(base)).toMatchObject({ ok: true, value: { name: "13th month", baseMultipleBp: 10000, payMonth: 12 } });
    expect(validateRule({ ...base, name: "CIP", kind: "cip", payMonth: 3, formula: "eligible_x_component_x_multiplier", baseMultipleBp: null, eligibleAmount: 40_000_000, componentNum: 1_381_505, deMinimis: 1_200_000 })).toMatchObject({ ok: true, value: { eligibleAmount: 40_000_000, deMinimis: 1_200_000 } });
    expect(validateRule({ ...base, name: "Spot", recurrence: "once", kind: "oneoff", onceOn: "2027-09", payMonth: 1, formula: "fixed", baseMultipleBp: null, fixedAmount: 1_500_000, deMinimis: 500_000 })).toMatchObject({ ok: true, value: { onceOn: "2027-09", payMonth: 9 } });
  });
  it("a one-off needs its month, and its pay month follows it", () => {
    expect(ruleErr({ ...base, recurrence: "once", kind: "oneoff", formula: "fixed", fixedAmount: 1, baseMultipleBp: null })).toMatch(/one-off/);
  });
  it("checks the formula's own fields", () => {
    expect(ruleErr({ ...base, baseMultipleBp: 0 })).toMatch(/months of base/);
    expect(ruleErr({ ...base, formula: "fixed", fixedAmount: null })).toMatch(/amount/);
    expect(ruleErr({ ...base, formula: "eligible_x_component_x_multiplier", eligibleAmount: 1, componentNum: null })).toMatch(/component/);
  });
  it("the 13th month repeats every year and has no de minimis", () => {
    expect(ruleErr({ ...base, deMinimis: 100 })).toMatch(/no de minimis/);
    expect(ruleErr({ ...base, recurrence: "once", onceOn: "2027-12" })).toMatch(/13th month/);
  });
  it("checks name, cutoff, month and kind", () => {
    expect(ruleErr({ ...base, name: "" })).toMatch(/name/);
    expect(ruleErr({ ...base, cutoff: "third" })).toMatch(/cutoff/);
    expect(ruleErr({ ...base, payMonth: 13 })).toMatch(/month/);
    expect(ruleErr({ ...base, kind: "x" })).toMatch(/kind/);
    expect(ruleErr(null)).toMatch(/Nothing/);
  });
});

describe("validateInstance", () => {
  const ok = { ruleId: RULE, year: 2027, multiplierNum: 125, splits: [{ kind: "fund", targetId: FUND, label: null, amount: 3_000_000, done: false }, { kind: "gift", targetId: null, label: " Mom's birthday ", amount: 500_000, done: true }], received: null };
  it("accepts splits to a fund and to a named destination", () => {
    expect(validateInstance(ok)).toMatchObject({ ok: true, value: { year: 2027, splits: [{ kind: "fund" }, { kind: "gift", label: "Mom's birthday", done: true }] } });
  });
  it("rejects a fund without an id, an unnamed gift, bad amounts and years", () => {
    const bad = (s: unknown, extra: object = {}) => validateInstance({ ...ok, splits: [s], ...extra }).ok;
    expect(bad({ kind: "fund", targetId: null, amount: 1 })).toBe(false);
    expect(bad({ kind: "gift", targetId: null, label: "", amount: 1 })).toBe(false);
    expect(bad({ kind: "gift", label: "x", amount: -1 })).toBe(false);
    expect(bad({ kind: "loot", label: "x", amount: 1 })).toBe(false);
    expect(bad({ kind: "gift", label: "x", amount: 1 }, { year: 1999 })).toBe(false);
  });
  it("checks what arrived when marking received", () => {
    expect(validateInstance({ ...ok, received: { gross: 6_000_000, deMinimis: 1_000_000, net: 5_900_000 } })).toMatchObject({ ok: true, value: { received: { net: 5_900_000 } } });
    expect(validateInstance({ ...ok, received: { gross: 1000, deMinimis: 2000, net: 500 } }).ok).toBe(false);
    expect(validateInstance({ ...ok, received: { gross: 1000, deMinimis: 0, net: 2000 } }).ok).toBe(false);
  });
});
