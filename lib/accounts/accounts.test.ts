import { describe, expect, it } from "vitest";
import { money } from "@/lib/domain/money";
import { parseAccountForm, parseLast4 } from "./input";
import { daysUntilDay, position } from "./summary";

const p = (n: number) => money(Math.round(n * 100));
const good = { kind: "debit", name: "BPI Savings", institution: "BPI", last4: "1234", balance: "12,345.67" };

describe("parseAccountForm", () => {
  it("reads a debit account", () => {
    const r = parseAccountForm(good);
    expect(r.ok && r.value).toMatchObject({ kind: "debit", name: "BPI Savings", institution: "BPI", last4: "1234", balance: p(12_345.67), creditLimit: null });
  });
  it("only ever keeps 4 digits: a full card number is refused, never trimmed", () => {
    for (const bad of ["4111111111111111", "12345", "123", "12a4", "4111 1111 1111 1111"]) {
      expect(parseAccountForm({ ...good, last4: bad }).ok).toBe(false);
    }
    expect(parseLast4("12 34")).toEqual({ ok: true, value: "1234" });
    expect(parseLast4("")).toEqual({ ok: true, value: null });
  });
  it("rejects bad kind, name, balance", () => {
    expect(parseAccountForm({ ...good, kind: "crypto" }).ok).toBe(false);
    expect(parseAccountForm({ ...good, name: "" }).ok).toBe(false);
    expect(parseAccountForm({ ...good, name: "x".repeat(31) }).ok).toBe(false);
    expect(parseAccountForm({ ...good, balance: "-5" }).ok).toBe(false);
    expect(parseAccountForm({ ...good, balance: "abc" }).ok).toBe(false);
  });
  it("takes limit and days only for a credit card", () => {
    const card = { kind: "credit", name: "Visa", balance: "4,500", creditLimit: "50,000", statementDay: "5", dueDay: "25" };
    const r = parseAccountForm(card);
    expect(r.ok && r.value).toMatchObject({ creditLimit: p(50_000), statementDay: 5, dueDay: 25 });
    expect(parseAccountForm({ ...card, dueDay: "32" }).ok).toBe(false);
    expect(parseAccountForm({ ...card, creditLimit: "0" }).ok).toBe(false);
    const debit = parseAccountForm({ ...good, creditLimit: "9,999", dueDay: "5" });
    expect(debit.ok && debit.value).toMatchObject({ creditLimit: null, dueDay: null });
  });
});

describe("position", () => {
  it("is cash minus card debt, with utilization over cards that have a limit", () => {
    const x = position([
      { kind: "ewallet", balance: p(1_000), creditLimit: null },
      { kind: "debit", balance: p(9_000), creditLimit: null },
      { kind: "credit", balance: p(5_000), creditLimit: p(20_000) },
      { kind: "credit", balance: p(3_000), creditLimit: null },
    ]);
    expect(x.cash).toBe(p(10_000));
    expect(x.debt).toBe(p(8_000));
    expect(x.net).toBe(p(2_000));
    expect(x.utilizationPct).toBe(25);
  });
  it("has no utilization without limits", () => {
    expect(position([{ kind: "credit", balance: p(100), creditLimit: null }]).utilizationPct).toBeNull();
  });
});

describe("daysUntilDay", () => {
  it("counts to the next time the day comes", () => {
    expect(daysUntilDay("2026-12-10", 25)).toBe(15);
    expect(daysUntilDay("2026-12-25", 25)).toBe(0);
    expect(daysUntilDay("2026-12-26", 5)).toBe(10);
    expect(daysUntilDay("2027-02-10", 31)).toBe(18); // February ends on the 28th
  });
});
