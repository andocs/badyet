import { describe, expect, it } from "vitest";
import { money } from "@/lib/domain/money";
import { dueByCutoff, dueInMonth, summarize, type InstalmentRow } from "./calc";

const p = (n: number) => money(Math.round(n * 100));
const base: InstalmentRow = {
  id: "1",
  name: "Phone",
  price: p(12_000),
  downPayment: p(0),
  termCount: 6,
  rateBp: null,
  firstDueOn: "2026-12-09",
  cutoff: "first",
  walletId: null,
};

describe("installment calculations", () => {
  it("splits a no-interest plan evenly", () => {
    const s = summarize(base, "2026-12-01");
    expect(s.perPayment).toBe(p(2_000));
    expect(s.total).toBe(p(12_000));
    expect(s.interest).toBe(0);
    expect(s.remaining).toBe(6);
    expect(s.lastDueOn).toBe("2027-05-09");
  });
  it("matches the old app for 20,000 at 6% over 60 months (V-I1)", () => {
    const s = summarize({ ...base, price: p(20_000), termCount: 60, rateBp: 600 }, "2026-12-01");
    expect(s.perPayment).toBe(p(386.66));
    expect(s.total).toBe(p(23_199.36));
    expect(s.interest).toBe(p(3_199.36));
  });
  it("counts remaining payments from today", () => {
    expect(summarize(base, "2027-02-01").remaining).toBe(4); // Feb, Mar, Apr, May
    expect(summarize(base, "2027-06-01").remaining).toBe(0);
  });
  it("subtracts a down payment before financing", () => {
    const s = summarize({ ...base, downPayment: p(3_000) }, "2026-12-01");
    expect(s.financed).toBe(p(9_000));
    expect(s.perPayment).toBe(p(1_500));
  });
  it("finds what is due in a month and per cutoff", () => {
    expect(dueInMonth(base, "2026-12")).toBe(p(2_000));
    expect(dueInMonth(base, "2027-06")).toBe(0);
    const second: InstalmentRow = { ...base, id: "2", cutoff: "second", price: p(3_000), termCount: 3 };
    expect(dueByCutoff([base, second], "2026-12")).toEqual({ first: p(2_000), second: p(1_000) });
    // the 3-payment plan runs Dec, Jan, Feb; the 6-payment plan runs Dec to May
    expect(dueByCutoff([base, second], "2027-02")).toEqual({ first: p(2_000), second: p(1_000) });
    expect(dueByCutoff([base, second], "2027-03")).toEqual({ first: p(2_000), second: 0 });
    expect(dueByCutoff([base, second], "2027-06")).toEqual({ first: 0, second: 0 });
  });
});
