import { describe, expect, it } from "vitest";
import { money } from "@/lib/domain/money";
import { anchorAmount, creditAvailable, creditOwed, parseNewAccount } from "./v13";

const ok = (input: Record<string, string>) => {
  const r = parseNewAccount(input);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const err = (input: Record<string, string>) => {
  const r = parseNewAccount(input);
  return r.ok ? null : r.error;
};

describe("parseNewAccount", () => {
  it("accepts a simple account and defaults the colour and opening balance", () => {
    expect(ok({ name: " GCash ", kind: "ewallet" })).toMatchObject({ name: "GCash", kind: "ewallet", opening: 0, color: "#2F5BD7", last4: null, creditLimit: null });
  });

  it("reads the opening amount in pesos", () => {
    expect(ok({ name: "BPI", kind: "debit", opening: "21,430.88", last4: "4821" })).toMatchObject({ opening: 2143088, last4: "4821" });
  });

  it("only keeps card details for credit accounts", () => {
    expect(ok({ name: "Card", kind: "credit", creditLimit: "50000", statementDay: "5", dueDay: "25" })).toMatchObject({ creditLimit: 5_000_000, statementDay: 5, dueDay: 25 });
    expect(ok({ name: "Cash", kind: "cash", creditLimit: "50000", statementDay: "5" })).toMatchObject({ creditLimit: null, statementDay: null });
  });

  it("rejects bad input with a plain message", () => {
    expect(err({ name: "", kind: "debit" })).toMatch(/name/);
    expect(err({ name: "x".repeat(31), kind: "debit" })).toMatch(/name/);
    expect(err({ name: "A", kind: "piggy" })).toMatch(/kind/);
    expect(err({ name: "A", kind: "debit", last4: "1234567890123456" })).toMatch(/four digits/);
    expect(err({ name: "A", kind: "debit", opening: "-5" })).toMatch(/amount/);
    expect(err({ name: "A", kind: "credit", statementDay: "32" })).toMatch(/1 to 31/);
    expect(err({ name: "A", kind: "credit", creditLimit: "abc" })).toMatch(/limit/);
  });
});

describe("credit helpers", () => {
  it("stores what you owe as a negative position and reads it back", () => {
    expect(anchorAmount("credit", money(12_000))).toBe(-12_000);
    expect(anchorAmount("debit", money(12_000))).toBe(12_000);
    expect(creditOwed(money(-12_000))).toBe(12_000);
    expect(creditOwed(money(500))).toBe(0);
    expect(creditAvailable(money(-12_000), money(50_000))).toBe(38_000);
    expect(creditAvailable(money(-60_000), money(50_000))).toBe(0);
    expect(creditAvailable(money(-1), null)).toBeNull();
  });
});
