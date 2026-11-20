import { describe, expect, it } from "vitest";
import { validatePaydays, validateSetup } from "./input";

const err = (x: unknown) => {
  const r = validateSetup(x);
  return r.ok ? null : r.error;
};

describe("validatePaydays", () => {
  it("accepts the usual 10th and 25th and other sensible pairs", () => {
    expect(validatePaydays(10, 25)).toEqual({ ok: true, value: { first: 10, second: 25 } });
    expect(validatePaydays(5, 20).ok).toBe(true);
    expect(validatePaydays(15, 30).ok).toBe(false); // second must be 28 or less
  });
  it("rejects days that break the cutoffs", () => {
    expect(validatePaydays(10, 11).ok).toBe(false); // too close
    expect(validatePaydays(25, 10).ok).toBe(false);
    expect(validatePaydays(0, 25).ok).toBe(false);
    expect(validatePaydays("10", 25).ok).toBe(false);
  });
});

describe("validateSetup", () => {
  const full = {
    accounts: [{ name: "GCash", kind: "ewallet", opening: "3,842.15", last4: "8841" }],
    salary: { base: 5_800_000, startMonth: "2026-01", title: " Analyst ", grade: "", sss: 175_000 },
    paydays: { first: 10, second: 25 },
    lines: [
      { name: "Rent", group: "Essentials", rule: "fixed", amount: 1_400_000 },
      { name: "Groceries", group: "Essentials", rule: "pct", pctBp: 1300 },
    ],
    funds: { emergency: true, travel: false },
  };
  it("accepts a full setup and trims text", () => {
    expect(validateSetup(full)).toMatchObject({ ok: true, value: { salary: { title: "Analyst", grade: null, sss: 175_000, pagibig: null }, funds: { emergency: true, travel: false } } });
  });
  it("every step can be skipped", () => {
    expect(validateSetup({})).toMatchObject({ ok: true, value: { accounts: [], salary: null, paydays: null, lines: null, funds: null } });
  });
  it("rejects bad salary, paydays and lines with a plain message", () => {
    expect(err({ salary: { base: 0, startMonth: "2026-01" } })).toMatch(/base pay/);
    expect(err({ salary: { base: 100, startMonth: "2026-13" } })).toMatch(/month/);
    expect(err({ paydays: { first: 10, second: 11 } })).toMatch(/two days/);
    expect(err({ salary: { base: 100, startMonth: "2026-01", sss: -5 } })).toMatch(/SSS/);
    expect(err({ lines: [{ name: "", group: "Wants", rule: "fixed", amount: 1 }] })).toMatch(/name/);
    expect(err({ lines: [{ name: "A", group: "Fun", rule: "fixed", amount: 1 }] })).toMatch(/group/);
    expect(err({ lines: [{ name: "A", group: "Wants", rule: "pct", pctBp: 20_000 }] })).toMatch(/0 to 100/);
    expect(err({ lines: [{ name: "A", group: "Wants", rule: "mystery" }] })).toMatch(/rule/);
  });
  it("percent lines cannot add up to more than 100%", () => {
    const l = (n: string, pctBp: number) => ({ name: n, group: "Wants", rule: "pct", pctBp });
    expect(err({ lines: [l("A", 6000), l("B", 5000)] })).toMatch(/more than 100%/);
    expect(validateSetup({ lines: [l("A", 6000), l("B", 4000)] }).ok).toBe(true);
  });
  it("keeps only string fields of accounts for the account validator", () => {
    const r = validateSetup({ accounts: [{ name: "A", kind: "cash", opening: 5, color: "#fff" }] });
    expect(r).toMatchObject({ ok: true, value: { accounts: [{ name: "A", kind: "cash", color: "#fff" }] } });
    expect(err({ accounts: [null] })).toMatch(/accounts/);
  });
});
