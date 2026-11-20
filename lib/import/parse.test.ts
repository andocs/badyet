import { describe, expect, it } from "vitest";
import { parseSnapshot } from "./parse";

// Synthetic snapshot (not real data).
const good = {
  version: 1,
  plan: { name: "Current", startDate: "2026-12-10", endDate: null },
  pay: { annualBase: "600,000.00", allowanceSecond: "2,000.00", sss: "1,750.00", pagibig: "200.00", savingsPlanPercent: "6" },
  wallets: ["Gcash", "BPI"],
  lines: [
    { cutoff: "first", bucket: "essentials", name: "Food", amount: "2,000.00", wallet: "Gcash" },
    { cutoff: "first", bucket: "essentials", name: "Installments", amount: "3,000.00", wallet: "BPI", source: "installments" },
    { cutoff: "second", bucket: "wants", name: "Wants", amount: "5,000.00", wallet: "" },
  ],
  installments: [{ name: "Phone", price: "36,000", termCount: "12", firstDueOn: "2026-07-16", cutoff: "first", wallet: "BPI" }],
  subscriptions: [{ name: "Streaming", amount: "169", cutoff: "first", wallet: "Gcash" }],
};

describe("parseSnapshot", () => {
  it("parses a full snapshot", () => {
    const r = parseSnapshot(good);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.plan.endDate).toBeNull();
    expect(r.value.pay?.annualBase).toBe(60_000_000);
    expect(r.value.lines).toHaveLength(3);
    expect(r.value.lines[0].amount).toBe(200_000);
    expect(r.value.lines[2].wallet).toBeNull();
    expect(r.value.lines[1].source).toBe("installments");
    expect(r.value.installments[0].value.termCount).toBe(12);
    expect(r.value.subscriptions[0].amount).toBe(16_900);
  });
  it("accepts a snapshot with only a plan", () => {
    expect(parseSnapshot({ version: 1, plan: { name: "A", startDate: "2026-12-01" } }).ok).toBe(true);
  });
  it("rejects other files and versions", () => {
    expect(parseSnapshot(null).ok).toBe(false);
    expect(parseSnapshot({ version: 2 }).ok).toBe(false);
    expect(parseSnapshot([]).ok).toBe(false);
  });
  it("rejects bad plan, pay, lines and unknown wallets, with a pointer to what is wrong", () => {
    expect(parseSnapshot({ ...good, plan: { name: "", startDate: "2026-12-10" } }).ok).toBe(false);
    expect(parseSnapshot({ ...good, pay: { annualBase: "" } }).ok).toBe(false);
    const bad = parseSnapshot({ ...good, lines: [{ cutoff: "first", bucket: "essentials", name: "X", amount: "1", wallet: "Nope" }] });
    expect(!bad.ok && bad.error).toMatch(/Line 1/);
    expect(parseSnapshot({ ...good, lines: [{ cutoff: "third", bucket: "essentials", name: "X", amount: "1" }] }).ok).toBe(false);
  });
  it("allows one synced line per cutoff and source only", () => {
    const dup = {
      ...good,
      lines: [
        { cutoff: "first", bucket: "essentials", name: "A", amount: "1", source: "installments" },
        { cutoff: "first", bucket: "essentials", name: "B", amount: "1", source: "installments" },
      ],
    };
    expect(parseSnapshot(dup).ok).toBe(false);
  });
});
