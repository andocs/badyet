import { describe, expect, it } from "vitest";
import { validateRaise, validateTemplates } from "./event-input";

const LINE = "11111111-1111-4111-8111-111111111111";
const LINE2 = "22222222-2222-4222-8222-222222222222";
const merit = { kind: "merit", status: "expected", month: "2027-07", pctBp: 350, allocations: [] };
const err = (x: unknown) => {
  const r = validateRaise(x);
  return r.ok ? null : r.error;
};

describe("validateRaise", () => {
  it("accepts a merit raise by percent, by amount, and a promotion with a title", () => {
    expect(validateRaise(merit)).toMatchObject({ ok: true, value: { kind: "merit", pctBp: 350, status: "expected" } });
    expect(validateRaise({ ...merit, pctBp: undefined, newBase: 8_000_000 })).toMatchObject({ ok: true, value: { newBase: 8_000_000 } });
    expect(validateRaise({ kind: "promotion", status: "confirmed", month: "2027-07", newBase: 9_000_000, title: " Lead ", allocations: [] })).toMatchObject({ ok: true, value: { title: "Lead" } });
  });

  it("checks allowances: name, amount, cutoff, and the month of a yearly one", () => {
    const base = { kind: "allowance", status: "confirmed", month: "2027-07", allocations: [] };
    const good = { name: "Transport", amount: 150_000, frequency: "monthly", cutoff: "second", taxable: false };
    expect(validateRaise({ ...base, allowance: good })).toMatchObject({ ok: true });
    expect(err({ ...base, allowance: { ...good, name: " " } })).toMatch(/Name/);
    expect(err({ ...base, allowance: { ...good, cutoff: "third" } })).toMatch(/cutoff/);
    expect(err({ ...base, allowance: { ...good, frequency: "yearly" } })).toMatch(/month/);
    expect(validateRaise({ ...base, allowance: { ...good, frequency: "yearly", payMonth: 6 } })).toMatchObject({ ok: true });
  });

  it("checks a one-off, which can be negative but not zero", () => {
    const base = { kind: "adjustment", status: "confirmed", month: "2027-07", allocations: [] };
    expect(validateRaise({ ...base, adjustment: { amount: 500_000, taxable: true } })).toMatchObject({ ok: true });
    expect(validateRaise({ ...base, adjustment: { amount: -500_000, taxable: false } })).toMatchObject({ ok: true });
    expect(err({ ...base, adjustment: { amount: 0, taxable: true } })).toMatch(/one-off/);
  });

  it("rejects bad months, kinds, statuses and amounts", () => {
    expect(err({ ...merit, month: "2027-13" })).toMatch(/month/);
    expect(err({ ...merit, kind: "bonus" })).toMatch(/what happened/);
    expect(err({ ...merit, status: "maybe" })).toMatch(/happened/);
    expect(err({ ...merit, pctBp: 0 })).toMatch(/percent/);
    expect(err({ ...merit, pctBp: 1.5 })).toMatch(/percent/);
    expect(err({ ...merit, pctBp: undefined, newBase: -5 })).toMatch(/base/);
    expect(err(null)).toMatch(/Nothing/);
  });

  it("checks where the extra goes: real ids, each line once, percents within 100%", () => {
    const ok = { ...merit, allocations: [{ lineId: LINE, mode: "amount", amount: 50_000 }, { lineId: LINE2, mode: "percent", pctBp: 5000 }] };
    expect(validateRaise(ok)).toMatchObject({ ok: true });
    expect(err({ ...merit, allocations: [{ lineId: "nope", mode: "amount", amount: 1 }] })).toMatch(/once/);
    expect(err({ ...merit, allocations: [{ lineId: LINE, mode: "amount", amount: 1 }, { lineId: LINE, mode: "amount", amount: 1 }] })).toMatch(/once/);
    expect(err({ ...merit, allocations: [{ lineId: LINE, mode: "percent", pctBp: 6000 }, { lineId: LINE2, mode: "percent", pctBp: 5000 }] })).toMatch(/more than/);
    expect(err({ ...merit, allocations: [{ lineId: LINE, mode: "percent", pctBp: 20_000 }] })).toMatch(/0 to 100/);
    expect(err({ ...merit, allocations: [{ lineId: LINE, mode: "amount", amount: -1 }] })).toMatch(/amounts/);
  });
});

describe("validateTemplates", () => {
  const first = [{ kind: "earning", label: "Basic pay", source: "base_share", shareBp: 5000 }];
  const second = [{ kind: "deduction", label: "Salary loan", source: "custom", amountOverride: 100_000 }];
  it("accepts a layout", () => {
    expect(validateTemplates({ month: "2027-03", first, second })).toMatchObject({ ok: true });
  });
  it("rejects bad lines", () => {
    const bad = (l: unknown) => validateTemplates({ month: "2027-03", first: [l], second: [] }).ok;
    expect(bad({ kind: "earning", label: "", source: "base_share" })).toBe(false);
    expect(bad({ kind: "tip", label: "X", source: "base_share" })).toBe(false);
    expect(bad({ kind: "earning", label: "X", source: "magic" })).toBe(false);
    expect(bad({ kind: "deduction", label: "X", source: "custom" })).toBe(false); // a custom line needs an amount
    expect(bad({ kind: "earning", label: "X", source: "base_share", shareBp: 20_000 })).toBe(false);
    expect(validateTemplates({ month: "2027-3", first, second }).ok).toBe(false);
  });
});
